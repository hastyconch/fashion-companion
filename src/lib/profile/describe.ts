import { CATEGORY_LABELS, type Category } from "@/lib/items/vocabulary";
import {
  ADVENTURE_LABELS,
  BOTTOM_FITS,
  COMFORT_LABELS,
  OCCASIONS,
  TOP_FITS,
  VIBES,
  type Preferences,
} from "./preferences";

export type ClosetItemFacts = {
  category: Category | null;
  colors: string[];
  description: string | null;
  style_tags: string[];
};

/** Quiz answers as plain sentences, for the AI and for showing back to the user. */
export function describePreferences(p: Preferences): string[] {
  const lines: string[] = [];
  if (p.occasions?.length) lines.push(`Dresses for: ${p.occasions.map((o) => OCCASIONS[o]).join(", ")}.`);
  if (p.vibes?.length) {
    lines.push(`Style directions: ${p.vibes.map((v) => `${VIBES[v].label} (${VIBES[v].blurb.toLowerCase()})`).join("; ")}.`);
  }
  const fits = [
    p.top_fit && `${TOP_FITS[p.top_fit].toLowerCase()} tops`,
    p.bottom_fit && `${BOTTOM_FITS[p.bottom_fit].toLowerCase()} bottoms`,
  ].filter(Boolean);
  if (fits.length) lines.push(`Prefers ${fits.join(" and ")}.`);
  if (p.colors_love?.length) lines.push(`Loves: ${p.colors_love.join(", ")}.`);
  if (p.colors_avoid?.length) lines.push(`Avoids: ${p.colors_avoid.join(", ")}.`);
  if (p.comfort) lines.push(`Comfort vs. polish: ${COMFORT_LABELS[p.comfort - 1].toLowerCase()}.`);
  if (p.adventure) lines.push(`Appetite for trends: ${ADVENTURE_LABELS[p.adventure - 1].toLowerCase()}.`);
  if (p.notes) lines.push(`In their words: "${p.notes}"`);
  return lines;
}

/** A compact picture of the closet: counts, dominant colors, style tags, examples. */
export function describeCloset(items: ClosetItemFacts[], maxExamples = 40): string[] {
  if (!items.length) return ["Closet: nothing added yet."];

  const byCategory = new Map<string, number>();
  const colors = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const item of items) {
    const cat = item.category ? CATEGORY_LABELS[item.category].toLowerCase() : "untagged";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    for (const c of item.colors) colors.set(c, (colors.get(c) ?? 0) + 1);
    for (const t of item.style_tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  }

  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");

  const lines = [
    `Closet: ${items.length} pieces. ${top(byCategory, 9)}.`,
    `Most common colors: ${top(colors, 6)}.`,
  ];
  if (tags.size) lines.push(`Most common style tags: ${top(tags, 6)}.`);
  const examples = items
    .map((i) => i.description)
    .filter((d): d is string => Boolean(d))
    .slice(0, maxExamples);
  if (examples.length) lines.push(`Pieces include: ${examples.join("; ")}.`);
  return lines;
}
