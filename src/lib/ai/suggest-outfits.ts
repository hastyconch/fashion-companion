import "server-only";

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { AiError, MODEL, REFUSAL_FALLBACK_BETA, getAnthropic, type AiClient } from "./client";

export const SuggestionsSchema = z.object({
  outfits: z.array(
    z.object({
      title: z.string().describe("2 to 5 words, plain and evocative."),
      pieces: z.array(z.string()).describe('Refs from the closet list, like "i4".'),
      why: z.string().describe("1 to 2 sentences: weather, occasion and their style."),
      tip: z.string().describe("One short styling tip."),
    }),
  ),
});
export type Suggestions = z.infer<typeof SuggestionsSchema>;

export type SuggestInput = {
  closet: string[];
  context: string[];
};

const SYSTEM_PROMPT = `You're a personal stylist planning what your client should wear today, using only pieces they own.

- Propose 3 outfits that are genuinely different from each other. Use only refs from their closet list (like "i4"). Never invent pieces.
- Each outfit needs a top and a bottom, or a dress, plus shoes if they own any. Add outerwear when the weather calls for it. Add a bag or an accessory only when it adds something.
- Dress for the weather: layers when it's cold or the temperature swings, nothing that will be miserable in rain or wind. Dress for the occasion too.
- Follow their style brief and answers. Respect colors they avoid and anything in their notes (for example "I run cold").
- Learn from their reactions: lean toward what they liked and away from what they disliked, using their reasons.
- Avoid pieces worn in the last few days unless the closet is very small.
- title: 2 to 5 words, plain and evocative, like "Soft navy layers". why: 1 to 2 sentences tying the outfit to today's weather, the occasion and their style. tip: one short, practical styling tip (tuck, roll, layer, what to swap if it rains). Speak to them directly as "you".`;

/** Asks the stylist for today's outfits. */
export async function suggestOutfits(
  input: SuggestInput,
  client: AiClient = getAnthropic(),
): Promise<Suggestions | { refused: true }> {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: [REFUSAL_FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(SuggestionsSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            // The closet changes rarely, so it's cached; today's context follows it.
            { type: "text", text: `Their closet:\n${input.closet.join("\n")}`, cache_control: { type: "ephemeral" } },
            { type: "text", text: input.context.join("\n") },
          ],
        },
      ],
    });
  } catch (error) {
    throw new AiError(error instanceof Error ? error.message : String(error));
  }

  if (response.stop_reason === "refusal") return { refused: true };
  if (response.stop_reason === "max_tokens") throw new AiError("Response was cut off.");
  if (!response.parsed_output) throw new AiError("No structured output in the response.");
  return response.parsed_output;
}
