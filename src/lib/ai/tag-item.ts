import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import { ItemTagsSchema, type ItemTags } from "@/lib/items/tags";
import { COLOR_NAMES } from "@/lib/items/vocabulary";
import { MODEL, REFUSAL_FALLBACK_BETA, getAnthropic } from "./client";

export type TagOutcome =
  | { kind: "tagged"; tags: ItemTags }
  | { kind: "not_clothing" }
  | { kind: "refused" };

export class TaggingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaggingError";
  }
}

const SYSTEM_PROMPT = `You catalog clothes for a personal wardrobe app. Each request shows one photo of a single item, usually laid flat, on a hanger or against a wall. Your tags power closet filters and, later, outfit suggestions, so be accurate and consistent.

- Tag the main garment only. Ignore the background, hangers, floors and any person wearing it.
- If several garments are visible, tag the most prominent one.
- Set is_clothing to false if there's no wearable item (clothing, shoes, bag or accessory) in the photo; fill the other fields with your best guess anyway.
- colors: only these names: ${COLOR_NAMES.join(", ")}. List 1 to 4, most dominant first. Ignore tiny details like stitching or small logos.
- formality: 1 lounge or gym, 2 casual weekend, 3 smart casual, 4 business, 5 formal or black tie.
- warmth: 1 very light (tank top, linen shorts), 3 medium (sweater, jeans), 5 very warm (down coat).
- seasons: when it would typically be worn; all four if it's year-round.
- style_tags: up to 5 short lowercase words such as minimalist, classic, preppy, streetwear, sporty, bohemian, romantic, edgy, vintage, workwear.
- description: 3 to 8 words a person would say, like "Navy merino crew-neck sweater" or "Black leather ankle boots". Don't include the brand.
- brand: only when a logo or label is clearly legible; otherwise null.
- material: your best guess from the texture and drape.`;

/** The slice of the SDK this module uses, so tests can pass a fake. */
export type TaggerClient = Pick<Anthropic, "beta">;

/**
 * Tags one clothing photo. `imageUrl` must be reachable by the Anthropic API
 * (a short-lived signed Storage URL), so the photo never passes through our
 * Worker.
 */
export async function tagItemImage(
  imageUrl: string,
  client: TaggerClient = getAnthropic(),
): Promise<TagOutcome> {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: [REFUSAL_FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(ItemTagsSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: "Tag this item." },
          ],
        },
      ],
    });
  } catch (error) {
    // Includes malformed structured output, which the SDK reports as a parse error.
    throw new TaggingError(error instanceof Error ? error.message : String(error));
  }

  if (response.stop_reason === "refusal") return { kind: "refused" };
  if (response.stop_reason === "max_tokens") throw new TaggingError("Response was cut off.");

  const tags = response.parsed_output;
  if (!tags) throw new TaggingError("No structured output in the response.");
  if (!tags.is_clothing) return { kind: "not_clothing" };
  return { kind: "tagged", tags };
}
