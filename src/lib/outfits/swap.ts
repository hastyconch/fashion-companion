import type { StylableItem } from "./closet";

type SwapContext = {
  /** Target warmth 1–5 for today's weather, if known. */
  warmth: number | null;
  avoidColors: string[];
  now: Date;
  /** Items already tried in this slot, so repeated swaps cycle through options. */
  exclude: string[];
};

/**
 * Picks a replacement for one piece, without an AI call: same category, not
 * already in the outfit, scored on formality, warmth, avoided colors and how
 * recently it was worn.
 */
export function pickSwap(
  outfit: StylableItem[],
  current: StylableItem,
  closet: StylableItem[],
  ctx: SwapContext,
): StylableItem | null {
  const inOutfit = new Set(outfit.map((i) => i.id));
  const excluded = new Set(ctx.exclude);
  const others = outfit.filter((i) => i.id !== current.id);
  // Match the rest of the outfit's formality.
  const known = others.map((i) => i.formality).filter((f): f is number => f !== null);
  const formality = known.length
    ? known.reduce((sum, f) => sum + f, 0) / known.length
    : (current.formality ?? 3);

  const candidates = closet.filter(
    (i) => i.category === current.category && !inOutfit.has(i.id) && !excluded.has(i.id),
  );
  if (!candidates.length) return null;

  const score = (i: StylableItem) => {
    let s = Math.abs((i.formality ?? 3) - formality) * 2;
    if (ctx.warmth !== null && i.warmth !== null) s += Math.abs(i.warmth - ctx.warmth) * 1.5;
    if (i.colors.some((c) => ctx.avoidColors.includes(c))) s += 4;
    if (i.last_worn_at) {
      const days = (ctx.now.getTime() - new Date(i.last_worn_at).getTime()) / 86_400_000;
      if (days < 3) s += 3 - days;
    }
    return s;
  };

  return [...candidates].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))[0];
}
