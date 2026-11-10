import "server-only";

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { AiError, MODEL, REFUSAL_FALLBACK_BETA, getAnthropic, type AiClient } from "./client";

export const StyleSummarySchema = z.object({
  summary: z.string().describe("2 to 3 sentences, second person, under 400 characters."),
  keywords: z.array(z.string()).describe("3 to 5 lowercase words or short phrases."),
});
export type StyleSummary = z.infer<typeof StyleSummarySchema>;

const SYSTEM_PROMPT = `You're a personal stylist writing a short brief about a client's style. The client will read it, and you'll rely on it later when putting outfits together from their closet.

- Write 2 to 3 sentences in the second person ("You..."), under 400 characters.
- Be concrete: name silhouettes, fits, colors and the occasions they dress for. Avoid generic phrases like "effortlessly stylish" or "versatile wardrobe".
- Ground it in their answers and their closet. If the two disagree (say they love color but own mostly neutrals), name the gap briefly; it's useful, not a criticism.
- Don't flatter, don't invent anything they didn't say or own, and don't mention brands.
- keywords: 3 to 5 lowercase words or short phrases that capture the style, such as "relaxed tailoring" or "earth tones".`;

/** Writes the style brief from the quiz answers and a closet summary. */
export async function writeStyleSummary(
  context: { answers: string[]; closet: string[] },
  client: AiClient = getAnthropic(),
): Promise<StyleSummary | { refused: true }> {
  const text = [
    "Their answers:",
    ...(context.answers.length ? context.answers : ["(They skipped the questions.)"]),
    "",
    ...context.closet,
  ].join("\n");

  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: [REFUSAL_FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(StyleSummarySchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });
  } catch (error) {
    throw new AiError(error instanceof Error ? error.message : String(error));
  }

  if (response.stop_reason === "refusal") return { refused: true };
  if (response.stop_reason === "max_tokens") throw new AiError("Response was cut off.");
  if (!response.parsed_output) throw new AiError("No structured output in the response.");
  return response.parsed_output;
}

/** Trims to the profile's column limits and tidies keywords. */
export function normalizeSummary(summary: StyleSummary) {
  return {
    style_memo: summary.summary.trim().slice(0, 800),
    style_keywords: [
      ...new Set(summary.keywords.map((k) => k.trim().toLowerCase().slice(0, 30)).filter(Boolean)),
    ].slice(0, 5),
  };
}
