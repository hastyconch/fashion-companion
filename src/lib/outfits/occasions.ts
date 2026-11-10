/** Kinds of day you can ask outfits for. Mirrored by a CHECK in the outfits migration. */
export const OUTFIT_OCCASIONS = {
  everyday: { label: "Everyday", brief: "an ordinary day: running errands, seeing friends, getting on with things" },
  work: { label: "Work", brief: "a day at work, matching how they described their workplace" },
  evening: { label: "Evening", brief: "an evening out: dinner, drinks or a show" },
  date: { label: "Date", brief: "a date: put-together, a little more effort, still comfortable" },
  active: { label: "Active", brief: "an active day: gym, a long walk or sport" },
  travel: { label: "Travel", brief: "a travel day: comfortable for hours, layers, easy shoes" },
} as const;

export type OutfitOccasion = keyof typeof OUTFIT_OCCASIONS;
export const OCCASION_KEYS = Object.keys(OUTFIT_OCCASIONS) as [OutfitOccasion, ...OutfitOccasion[]];

/** Quick reasons offered after a 👎; they're fed back to the stylist. */
export const DISLIKE_REASONS = [
  "Too formal",
  "Too casual",
  "Wrong for the weather",
  "Doesn't go together",
  "Not my style",
  "Wore it recently",
] as const;

export function isOccasion(value: unknown): value is OutfitOccasion {
  return typeof value === "string" && value in OUTFIT_OCCASIONS;
}
