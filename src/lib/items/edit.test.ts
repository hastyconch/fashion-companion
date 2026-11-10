import { describe, expect, it } from "vitest";

import { parseEditForm } from "./edit";

function form(entries: [string, string][]) {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
}

describe("parseEditForm", () => {
  it("turns a filled-in form into column values", () => {
    const result = parseEditForm(
      form([
        ["category", "outerwear"],
        ["subcategory", " trench coat "],
        ["colors", "beige"],
        ["colors", "brown"],
        ["pattern", "solid"],
        ["material", "cotton gabardine"],
        ["formality", "3"],
        ["warmth", "3"],
        ["seasons", "spring"],
        ["seasons", "autumn"],
        ["style_tags", "Classic, timeless, classic"],
        ["description", "Beige double-breasted trench coat"],
        ["brand", ""],
      ]),
    );
    expect(result).toEqual({
      ok: true,
      columns: {
        category: "outerwear",
        subcategory: "trench coat",
        colors: ["beige", "brown"],
        pattern: "solid",
        material: "cotton gabardine",
        formality: 3,
        warmth: 3,
        seasons: ["spring", "autumn"],
        style_tags: ["classic", "timeless"],
        description: "Beige double-breasted trench coat",
        brand: null,
      },
    });
  });

  it("allows leaving optional fields empty", () => {
    const result = parseEditForm(form([["category", "top"]]));
    expect(result).toMatchObject({
      ok: true,
      columns: { category: "top", colors: [], pattern: null, formality: null, style_tags: [] },
    });
  });

  it("rejects values outside the vocabulary or range", () => {
    expect(parseEditForm(form([["category", "hat"]])).ok).toBe(false);
    expect(parseEditForm(form([["category", "top"], ["colors", "teal"]])).ok).toBe(false);
    expect(parseEditForm(form([["category", "top"], ["warmth", "7"]])).ok).toBe(false);
    expect(
      parseEditForm(form([["category", "top"], ...Array.from({ length: 5 }, () => ["colors", "red"] as [string, string])])).ok,
    ).toBe(false);
  });

  it("says which field is wrong", () => {
    expect(parseEditForm(form([["category", "top"], ["formality", "0"]]))).toEqual({
      ok: false,
      error: "Check the formality field.",
    });
  });
});
