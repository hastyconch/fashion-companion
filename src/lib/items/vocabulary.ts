/**
 * The fixed vocabulary used for item tags. Shared by the AI tagger, the
 * closet filters and the tag editor, and mirrored by CHECK constraints in
 * supabase/migrations/20261111000000_items.sql. Change both together.
 */

export const CATEGORIES = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "accessory",
  "activewear",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  bag: "Bags",
  accessory: "Accessories",
  activewear: "Activewear",
  other: "Other",
};

export const CATEGORY_SINGULAR: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outerwear: "Outerwear",
  shoes: "Shoes",
  bag: "Bag",
  accessory: "Accessory",
  activewear: "Activewear",
  other: "Other",
};

/** A fixed palette so "show me everything navy" works reliably. */
export const COLORS = {
  black: "#1c1c1c",
  white: "#fafafa",
  grey: "#9a9a9a",
  navy: "#1f2a44",
  blue: "#2f6fb5",
  "light blue": "#a9c8e8",
  green: "#2e7d4f",
  olive: "#6b6b3a",
  brown: "#6b4426",
  tan: "#c19a6b",
  beige: "#e3d5b8",
  cream: "#f3ead3",
  red: "#c0392b",
  burgundy: "#7a2333",
  pink: "#e8a1b8",
  purple: "#6d4c9a",
  yellow: "#e9c93d",
  orange: "#e07b2a",
  gold: "#c9a227",
  silver: "#c0c4c8",
} as const;
export type Color = keyof typeof COLORS;
export const COLOR_NAMES = Object.keys(COLORS) as [Color, ...Color[]];

export const PATTERNS = [
  "solid",
  "striped",
  "checked",
  "floral",
  "graphic",
  "animal",
  "dotted",
  "textured",
  "other",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const ITEM_STATUSES = ["active", "laundry", "archived"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const FORMALITY_LABELS = ["Lounge", "Casual", "Smart casual", "Business", "Formal"] as const;
export const WARMTH_LABELS = ["Very light", "Light", "Medium", "Warm", "Very warm"] as const;

/** Column limits from the items table, enforced again before every write. */
export const LIMITS = {
  subcategory: 60,
  material: 60,
  description: 120,
  brand: 60,
  colors: 4,
  styleTags: 8,
  styleTag: 30,
} as const;
