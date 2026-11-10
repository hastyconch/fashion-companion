import type { Category } from "@/lib/items/vocabulary";

/** The item fields outfit planning uses. */
export type StylableItem = {
  id: string;
  category: Category;
  subcategory: string | null;
  colors: string[];
  pattern: string | null;
  material: string | null;
  formality: number | null;
  warmth: number | null;
  seasons: string[];
  style_tags: string[];
  description: string | null;
  last_worn_at: string | null;
};

const CATEGORY_ORDER: Category[] = [
  "top", "bottom", "dress", "outerwear", "shoes", "bag", "accessory", "activewear", "other",
];

/**
 * The closet as compact lines with short references (i1, i2, …). The model
 * only ever sees these refs, never real IDs, so it can't invent a valid one.
 */
export function closetForAi(items: StylableItem[]) {
  const sorted = [...items].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
  const refToId = new Map<string, string>();
  const idToRef = new Map<string, string>();
  const lines = sorted.map((item, i) => {
    const ref = `i${i + 1}`;
    refToId.set(ref, item.id);
    idToRef.set(item.id, ref);
    const facts = [
      item.category,
      item.subcategory,
      item.colors.join("/") || null,
      item.pattern && item.pattern !== "solid" ? item.pattern : null,
      item.material,
      item.formality ? `formality ${item.formality}/5` : null,
      item.warmth ? `warmth ${item.warmth}/5` : null,
      item.seasons.length && item.seasons.length < 4 ? item.seasons.join("/") : null,
      item.style_tags.length ? item.style_tags.join(", ") : null,
    ].filter(Boolean);
    return `${ref}: ${item.description ?? item.subcategory ?? item.category} (${facts.join("; ")})`;
  });
  return { lines, refToId, idToRef };
}

/** What's missing before complete outfits are possible, if anything. */
export function closetReadiness(items: StylableItem[]): { ready: boolean; missing: string[] } {
  const has = (c: Category) => items.some((i) => i.category === c);
  const hasTopLike = has("top") || has("activewear");
  const hasBottomLike = has("bottom") || has("activewear");
  const missing: string[] = [];
  if (!has("dress") && !(hasTopLike && hasBottomLike)) {
    if (!hasTopLike) missing.push("a top");
    if (!hasBottomLike) missing.push("a bottom (trousers, jeans, a skirt) or a dress");
  }
  if (!has("shoes")) missing.push("a pair of shoes");
  return { ready: missing.length === 0, missing };
}

/** Rough target warmth (1–5) for the day's feels-like temperature in °C. */
export function targetWarmth(feelsLike: number | null): number | null {
  if (feelsLike === null) return null;
  if (feelsLike >= 24) return 1;
  if (feelsLike >= 18) return 2;
  if (feelsLike >= 12) return 3;
  if (feelsLike >= 5) return 4;
  return 5;
}
