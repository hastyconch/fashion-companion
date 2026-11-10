import { z } from "zod";

import {
  CATEGORIES,
  COLOR_NAMES,
  LIMITS,
  PATTERNS,
  SEASONS,
  type Category,
  type Color,
  type Pattern,
  type Season,
} from "./vocabulary";

/** What the AI tagger must return for each photo. */
export const ItemTagsSchema = z.object({
  is_clothing: z
    .boolean()
    .describe("False if the photo doesn't show a wearable item (clothing, shoes, bag or accessory)."),
  category: z.enum(CATEGORIES),
  subcategory: z.string().describe("Specific type, e.g. t-shirt, jeans, sneakers, blazer."),
  colors: z
    .array(z.enum(COLOR_NAMES))
    .describe("1 to 4 main colors from the palette, most dominant first."),
  pattern: z.enum(PATTERNS),
  material: z.string().describe("Best guess from the texture, e.g. cotton, denim, wool, leather."),
  formality: z.number().int().describe("1 lounge/gym, 2 casual, 3 smart casual, 4 business, 5 formal."),
  warmth: z.number().int().describe("1 very light (linen shorts) to 5 very warm (down coat)."),
  seasons: z.array(z.enum(SEASONS)).describe("Seasons it's typically worn in."),
  style_tags: z.array(z.string()).describe("Up to 5 short lowercase style words."),
  description: z.string().describe('3 to 8 words, e.g. "Navy merino crew-neck sweater".'),
  brand: z.string().nullable().describe("Only if a logo or label is clearly legible, else null."),
});
export type ItemTags = z.infer<typeof ItemTagsSchema>;

/** The columns a tagging result (or a manual edit) writes to `items`. */
export type ItemTagColumns = {
  category: Category;
  subcategory: string | null;
  colors: Color[];
  pattern: Pattern | null;
  material: string | null;
  formality: number | null;
  warmth: number | null;
  seasons: Season[];
  style_tags: string[];
  description: string | null;
  brand: string | null;
};

/**
 * Normalizes model output into values that satisfy the table's constraints:
 * trims, clamps scales to 1-5, de-duplicates and caps list lengths.
 */
export function toTagColumns(tags: ItemTags): ItemTagColumns {
  return {
    category: tags.category,
    subcategory: clean(tags.subcategory, LIMITS.subcategory),
    colors: unique(tags.colors).slice(0, LIMITS.colors),
    pattern: tags.pattern,
    material: clean(tags.material, LIMITS.material),
    formality: clampScale(tags.formality),
    warmth: clampScale(tags.warmth),
    seasons: unique(tags.seasons),
    style_tags: unique(
      tags.style_tags
        .map((t) => t.trim().toLowerCase().slice(0, LIMITS.styleTag))
        .filter(Boolean),
    ).slice(0, LIMITS.styleTags),
    description: clean(tags.description, LIMITS.description),
    brand: clean(tags.brand, LIMITS.brand),
  };
}

function clean(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampScale(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
