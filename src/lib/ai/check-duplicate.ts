import "server-only";

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { AiError, MODEL, REFUSAL_FALLBACK_BETA, getAnthropic, type AiClient } from "./client";

export const DuplicateVerdictSchema = z.object({
  verdict: z
    .enum(["same", "similar", "different"])
    .describe("same: one of the closet items IS this garment. similar: alike but a different garment. different: nothing alike."),
  match: z.string().nullable().describe('The ref of the matching closet item, like "c2", or null.'),
  reason: z.string().describe("One short sentence the owner will read, naming the details you compared."),
});
export type DuplicateVerdict = z.infer<typeof DuplicateVerdictSchema>;

export type DuplicateCandidate = { ref: string; imageUrl: string; description: string | null };

const SYSTEM_PROMPT = `You help a wardrobe app avoid cataloging the same garment twice.

The first photo is an item the owner just added. The others are items already in their closet, each labeled with a ref like "c1". Decide whether the new photo shows one of those exact items: the same physical garment photographed again, maybe from another angle, folded or hung differently, in other light or on another background.

- Compare the details that tell similar pieces apart: neckline and collar, buttons and zips, pockets, seams and hems, fabric texture and weave, print or stripe placement, logos and labels, fading or wear.
- same: the details match and you'd bet on it. Lighting, angle, background, folding and color cast don't count as differences.
- similar: the same kind of piece in the same colors, but a detail differs or you can't tell. Two plain black tees from different brands are similar, not same.
- different: nothing in the closet is close.
- match: the ref of the closet item for same or similar, otherwise null. Only use refs you were shown.
- reason: one short sentence for the owner, like "Same cable knit and horn buttons." or "Different collar: this one has a button-down collar."`;

/**
 * Compares a new item's photo with a few likely matches from the closet.
 * URLs must be reachable by the Anthropic API (short-lived signed Storage URLs).
 */
export async function checkDuplicate(
  newImageUrl: string,
  candidates: DuplicateCandidate[],
  client: AiClient = getAnthropic(),
): Promise<DuplicateVerdict | { refused: true }> {
  const content = [
    { type: "text" as const, text: "New item:" },
    { type: "image" as const, source: { type: "url" as const, url: newImageUrl } },
    { type: "text" as const, text: "Already in the closet:" },
    ...candidates.flatMap((c) => [
      { type: "text" as const, text: `${c.ref}: ${c.description ?? "untitled item"}` },
      { type: "image" as const, source: { type: "url" as const, url: c.imageUrl } },
    ]),
    { type: "text" as const, text: "Is the new item one of these?" },
  ];

  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: [REFUSAL_FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(DuplicateVerdictSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });
  } catch (error) {
    throw new AiError(error instanceof Error ? error.message : String(error));
  }

  if (response.stop_reason === "refusal") return { refused: true };
  if (response.stop_reason === "max_tokens") throw new AiError("Response was cut off.");
  if (!response.parsed_output) throw new AiError("No structured output in the response.");
  return response.parsed_output;
}
