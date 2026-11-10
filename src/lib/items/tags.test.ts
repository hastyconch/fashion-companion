import { describe, expect, it } from "vitest";

import { ItemTagsSchema, toTagColumns, type ItemTags } from "./tags";

const base: ItemTags = {
  is_clothing: true,
  category: "top",
  subcategory: "sweater",
  colors: ["navy"],
  pattern: "solid",
  material: "merino wool",
  formality: 3,
  warmth: 4,
  seasons: ["autumn", "winter"],
  style_tags: ["classic"],
  description: "Navy merino crew-neck sweater",
  brand: null,
};

describe("ItemTagsSchema", () => {
  it("accepts a well-formed result", () => {
    expect(ItemTagsSchema.parse(base)).toEqual(base);
  });

  it("rejects colors outside the palette", () => {
    expect(() => ItemTagsSchema.parse({ ...base, colors: ["teal"] })).toThrow();
  });

  it("rejects unknown categories", () => {
    expect(() => ItemTagsSchema.parse({ ...base, category: "hat" })).toThrow();
  });
});

describe("toTagColumns", () => {
  it("keeps clean values as they are", () => {
    expect(toTagColumns(base)).toEqual({
      category: "top",
      subcategory: "sweater",
      colors: ["navy"],
      pattern: "solid",
      material: "merino wool",
      formality: 3,
      warmth: 4,
      seasons: ["autumn", "winter"],
      style_tags: ["classic"],
      description: "Navy merino crew-neck sweater",
      brand: null,
    });
  });

  it("clamps scales into 1-5", () => {
    const columns = toTagColumns({ ...base, formality: 9, warmth: 0 });
    expect(columns.formality).toBe(5);
    expect(columns.warmth).toBe(1);
  });

  it("dedupes and caps lists to what the database allows", () => {
    const columns = toTagColumns({
      ...base,
      colors: ["navy", "navy", "white", "grey", "black", "red"],
      seasons: ["winter", "winter"],
      style_tags: [" Classic ", "classic", "", "a", "b", "c", "d", "e", "f", "g", "h"],
    });
    expect(columns.colors).toEqual(["navy", "white", "grey", "black"]);
    expect(columns.seasons).toEqual(["winter"]);
    expect(columns.style_tags).toEqual(["classic", "a", "b", "c", "d", "e", "f", "g"]);
  });

  it("trims text, turns blanks into null and truncates to column limits", () => {
    const columns = toTagColumns({
      ...base,
      brand: "  ",
      material: "  cotton ",
      description: "x".repeat(200),
    });
    expect(columns.brand).toBeNull();
    expect(columns.material).toBe("cotton");
    expect(columns.description).toHaveLength(120);
  });
});
