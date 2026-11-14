import type { Category } from "@/lib/items/vocabulary";

/** How far back the stylist looks to avoid repeating itself. */
export const VARIETY_DAYS = 14;
/** A piece in this many recent suggestions is "leaned on a lot". */
const OVERUSED_AT = 4;
const MAX_RECENT_LINES = 21;

/** Pieces an outfit is built around; bags and accessories rotate on their own. */
const CORE: ReadonlySet<Category> = new Set(["top", "bottom", "dress", "outerwear", "shoes", "activewear"]);

export type RecentOutfit = { for_date: string; itemIds: string[] };

/** Order-independent identity of an outfit, for spotting repeats. */
export function piecesKey(itemIds: string[]): string {
  return [...new Set(itemIds)].sort().join("+");
}

/** The YYYY-MM-DD date `days` before `date`. */
export function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * What the stylist has suggested lately, so it stops proposing the same few
 * outfits: the combinations to avoid, the pieces it keeps reaching for, and
 * the ones it hasn't used at all.
 */
export function describeVariety(
  recent: RecentOutfit[],
  items: { id: string; category: Category }[],
  idToRef: Map<string, string>,
): { lines: string[]; recentKeys: Set<string> } {
  const recentKeys = new Set<string>();
  const uses = new Map<string, number>();
  const combos: string[] = [];
  for (const outfit of recent) {
    const key = piecesKey(outfit.itemIds);
    if (!outfit.itemIds.length || recentKeys.has(key)) continue;
    recentKeys.add(key);
    for (const id of new Set(outfit.itemIds)) uses.set(id, (uses.get(id) ?? 0) + 1);
    const refs = outfit.itemIds.map((id) => idToRef.get(id)).filter(Boolean);
    if (refs.length && combos.length < MAX_RECENT_LINES) combos.push(`- ${shortDate(outfit.for_date)}: ${refs.join(", ")}`);
  }

  const core = items.filter((i) => CORE.has(i.category));
  const unused = core.filter((i) => !uses.has(i.id)).map((i) => idToRef.get(i.id));
  const overused = core
    .filter((i) => (uses.get(i.id) ?? 0) >= OVERUSED_AT)
    .sort((a, b) => uses.get(b.id)! - uses.get(a.id)!)
    .map((i) => `${idToRef.get(i.id)} (${uses.get(i.id)} times)`);

  const lines: string[] = [];
  if (combos.length) lines.push("Suggested in the last two weeks (don't repeat these or near-copies):", ...combos);
  if (overused.length) lines.push(`Pieces you've leaned on a lot lately, use sparingly: ${overused.join(", ")}.`);
  if (unused.length && recent.length) lines.push(`Pieces you haven't suggested in the last two weeks: ${unused.join(", ")}.`);
  return { lines, recentKeys };
}

/** A deterministic shuffle: the same seed gives the same order. */
export function seededShuffle<T>(values: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const random = () => {
    // mulberry32
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
