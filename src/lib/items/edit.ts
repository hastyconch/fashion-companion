import { z } from "zod";

import type { ItemTagColumns } from "./tags";
import { CATEGORIES, COLOR_NAMES, LIMITS, PATTERNS, SEASONS } from "./vocabulary";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const optionalScale = z
  .string()
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number().int().min(1).max(5).nullable());

const EditSchema = z.object({
  category: z.enum(CATEGORIES),
  subcategory: optionalText(LIMITS.subcategory),
  colors: z.array(z.enum(COLOR_NAMES)).max(LIMITS.colors),
  pattern: z
    .union([z.enum(PATTERNS), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  material: optionalText(LIMITS.material),
  formality: optionalScale,
  warmth: optionalScale,
  seasons: z.array(z.enum(SEASONS)),
  style_tags: z
    .string()
    .transform((v) =>
      [...new Set(v.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))],
    )
    .pipe(z.array(z.string().max(LIMITS.styleTag)).max(LIMITS.styleTags)),
  description: optionalText(LIMITS.description),
  brand: optionalText(LIMITS.brand),
});

export type EditResult =
  | { ok: true; columns: ItemTagColumns }
  | { ok: false; error: string };

/** Validates the tag editor form into column values for `items`. */
export function parseEditForm(form: FormData): EditResult {
  const result = EditSchema.safeParse({
    category: form.get("category"),
    subcategory: form.get("subcategory") ?? "",
    colors: form.getAll("colors"),
    pattern: form.get("pattern") ?? "",
    material: form.get("material") ?? "",
    formality: form.get("formality") ?? "",
    warmth: form.get("warmth") ?? "",
    seasons: form.getAll("seasons"),
    style_tags: form.get("style_tags") ?? "",
    description: form.get("description") ?? "",
    brand: form.get("brand") ?? "",
  });

  if (!result.success) {
    const issue = result.error.issues[0];
    const field = String(issue?.path[0] ?? "form").replace("_", " ");
    return { ok: false, error: `Check the ${field} field.` };
  }
  return { ok: true, columns: result.data };
}
