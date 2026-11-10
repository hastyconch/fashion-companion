import { z } from "zod";

import { COLOR_NAMES, type Color } from "@/lib/items/vocabulary";

/** What the user dresses for in a typical month. */
export const OCCASIONS = {
  office: "Office",
  smart_work: "Smart-casual work",
  remote: "Working from home",
  campus: "Campus",
  active: "Gym & sport",
  evenings: "Evenings out",
  dates: "Dates",
  events: "Weddings & events",
  travel: "Travel",
  outdoors: "Outdoors",
} as const;
export type Occasion = keyof typeof OCCASIONS;

/** Style directions, each with a one-line description and a small palette for its card. */
export const VIBES = {
  minimalist: { label: "Minimalist", blurb: "Clean lines, few colors", swatch: ["#1c1c1c", "#e3d5b8", "#fafafa"] },
  classic: { label: "Classic", blurb: "Timeless, never trendy", swatch: ["#1f2a44", "#f3ead3", "#6b4426"] },
  tailored: { label: "Sharp & tailored", blurb: "Structured, polished", swatch: ["#2b2b2b", "#9a9a9a", "#fafafa"] },
  preppy: { label: "Preppy", blurb: "Knits, collars, stripes", swatch: ["#1f2a44", "#c0392b", "#fafafa"] },
  streetwear: { label: "Streetwear", blurb: "Graphic, relaxed, bold", swatch: ["#1c1c1c", "#e07b2a", "#9a9a9a"] },
  sporty: { label: "Sporty", blurb: "Athleisure, easy movement", swatch: ["#2f6fb5", "#fafafa", "#1c1c1c"] },
  bohemian: { label: "Bohemian", blurb: "Flowy, earthy, layered", swatch: ["#c19a6b", "#6b6b3a", "#e07b2a"] },
  romantic: { label: "Romantic", blurb: "Soft, delicate details", swatch: ["#e8a1b8", "#f3ead3", "#a9c8e8"] },
  edgy: { label: "Edgy", blurb: "Leather, black, contrast", swatch: ["#1c1c1c", "#7a2333", "#c0c4c8"] },
  vintage: { label: "Vintage", blurb: "Thrifted, retro shapes", swatch: ["#7a2333", "#c9a227", "#6b4426"] },
  workwear: { label: "Utility", blurb: "Workwear, sturdy fabrics", swatch: ["#6b6b3a", "#c19a6b", "#1f2a44"] },
  eclectic: { label: "Eclectic", blurb: "Mix of everything, playful", swatch: ["#6d4c9a", "#e9c93d", "#2e7d4f"] },
} as const;
export type Vibe = keyof typeof VIBES;
export const MAX_VIBES = 3;

export const TOP_FITS = { fitted: "Fitted", regular: "Regular", relaxed: "Relaxed", oversized: "Oversized" } as const;
export const BOTTOM_FITS = { slim: "Slim", straight: "Straight", relaxed: "Relaxed", wide: "Wide" } as const;

export const COMFORT_LABELS = ["Comfort first", "Mostly comfort", "Balanced", "Mostly polished", "Always polished"] as const;
export const ADVENTURE_LABELS = ["Keep it classic", "Mostly safe", "Open to ideas", "Like to experiment", "Love trends"] as const;

export const NOTES_MAX = 300;

const keysOf = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const scale = z.number().int().min(1).max(5);

/** Every answer is optional: steps can be skipped and saved one at a time. */
export const PreferencesSchema = z
  .object({
    occasions: z.array(z.enum(keysOf(OCCASIONS))).max(10),
    vibes: z.array(z.enum(keysOf(VIBES))).max(MAX_VIBES),
    top_fit: z.enum(keysOf(TOP_FITS)).nullable(),
    bottom_fit: z.enum(keysOf(BOTTOM_FITS)).nullable(),
    colors_love: z.array(z.enum(COLOR_NAMES)).max(8),
    colors_avoid: z.array(z.enum(COLOR_NAMES)).max(8),
    comfort: scale.nullable(),
    adventure: scale.nullable(),
    notes: z.string().trim().max(NOTES_MAX),
  })
  .partial()
  .strict();
export type Preferences = z.infer<typeof PreferencesSchema>;

/**
 * Merges a step's answers into what's saved, validating both. Unknown or
 * invalid stored data is dropped rather than blocking the save. A color can't
 * be both loved and avoided: the newer choice wins.
 */
export function mergePreferences(
  stored: unknown,
  patch: unknown,
): { ok: true; value: Preferences } | { ok: false; error: string } {
  const next = PreferencesSchema.safeParse(patch);
  if (!next.success) return { ok: false, error: "Some answers weren't valid. Try again." };

  const current = PreferencesSchema.safeParse(stored);
  const merged: Preferences = { ...(current.success ? current.data : {}), ...next.data };

  const love = new Set<Color>(merged.colors_love ?? []);
  const avoid = new Set<Color>(merged.colors_avoid ?? []);
  if (next.data.colors_avoid) for (const c of avoid) love.delete(c);
  else if (next.data.colors_love) for (const c of love) avoid.delete(c);
  if (merged.colors_love) merged.colors_love = [...love];
  if (merged.colors_avoid) merged.colors_avoid = [...avoid];

  return { ok: true, value: merged };
}

/** Reads stored answers defensively (bad data becomes "no answer"). */
export function readPreferences(stored: unknown): Preferences {
  const parsed = PreferencesSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

/** Rounds coordinates to ~1 km: plenty for weather, kinder to privacy. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
