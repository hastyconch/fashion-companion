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

- Use only refs from their closet list (like "i4"). Never invent pieces.
- Each outfit needs a top and a bottom, or a dress, plus shoes if they own any. Add outerwear when the weather calls for it. Add a bag or an accessory only when it adds something.
- Dress for the weather: layers when it's cold or the temperature swings, nothing that will be miserable in rain or wind. Dress for the occasion too.

Make the 3 outfits a real range, in this order:
1. Easy: the one they'd reach for, leaning into their comfort preference.
2. Balanced: a step more put together than the easy one.
3. Stretch: something they might not have thought of. A color pairing, a rarely used piece, a different silhouette or a bit more polish. It should still be right for the weather and the occasion, and wearable, not a costume.
The three should differ in silhouette, color and texture. Don't build them around the same piece: each top or dress appears in at most one outfit, and don't give all three the same bottoms or shoes when they own alternatives.

Variety across days matters as much as within a day:
- Never repeat an outfit from their recent suggestions, or a near-copy with one piece swapped.
- Rotate the closet. Work in pieces you haven't suggested lately when they suit the day, and go easy on pieces you've leaned on a lot.
- Avoid pieces worn in the last few days unless the closet is very small.

Read their answers as a baseline, not a ceiling:
- Comfort vs. polish: "comfort first" means nothing that pinches, itches or needs fussing, and soft, easy fabrics. It doesn't mean every outfit is the most casual option. Comfortable can still look sharp: a soft knit with tailored trousers, an unstructured jacket over a tee.
- Follow their style brief, colors and notes. Never use colors they avoid, and respect anything in their notes (for example "I run cold").
- Learn from their reactions: lean toward what they liked and away from what they disliked, using their reasons. A dislike of one outfit isn't a ban on its pieces.

title: 2 to 5 words, plain and evocative, like "Soft navy layers". why: 1 to 2 sentences tying the outfit to today's weather, the occasion and their style. tip: one short, practical styling tip (tuck, roll, layer, what to swap if it rains). Speak to them directly as "you".`;

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
