import type { Category } from "@/lib/items/vocabulary";
import type { StylableItem } from "./closet";

/** How many pieces of each category one outfit may contain. */
const MAX_PER_CATEGORY: Record<Category, number> = {
  top: 2, // e.g. a tee under an overshirt
  bottom: 1,
  dress: 1,
  outerwear: 1,
  shoes: 1,
  bag: 1,
  accessory: 2,
  activewear: 2,
  other: 1,
};

export type OutfitCheck = { ok: true; itemIds: string[] } | { ok: false; reason: string };

/**
 * Checks an AI-proposed outfit against the user's available items. Never trust
 * the model: every piece must exist and be available, and the outfit must be
 * complete and wearable.
 */
export function checkOutfit(
  itemIds: string[],
  available: Map<string, StylableItem>,
  options: { requireShoes: boolean },
): OutfitCheck {
  const ids = [...new Set(itemIds)];
  if (ids.length < 2) return { ok: false, reason: "too few pieces" };
  if (ids.length > 8) return { ok: false, reason: "too many pieces" };

  const counts = new Map<Category, number>();
  for (const id of ids) {
    const item = available.get(id);
    if (!item) return { ok: false, reason: "unknown or unavailable piece" };
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  for (const [category, n] of counts) {
    if (n > MAX_PER_CATEGORY[category]) return { ok: false, reason: `too many ${category} pieces` };
  }

  const n = (c: Category) => counts.get(c) ?? 0;
  const hasDress = n("dress") > 0;
  if (hasDress && n("bottom") > 0) return { ok: false, reason: "dress with a bottom" };
  const topLike = n("top") + n("activewear");
  const bottomLike = n("bottom") + n("activewear");
  const twoPieces = n("top") > 0 || n("bottom") > 0 ? topLike > 0 && bottomLike > 0 : n("activewear") >= 2;
  if (!hasDress && !twoPieces) return { ok: false, reason: "needs a top and a bottom, or a dress" };
  if (options.requireShoes && n("shoes") === 0) return { ok: false, reason: "missing shoes" };

  return { ok: true, itemIds: ids };
}
