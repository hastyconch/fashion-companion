import { describe, expect, it } from "vitest";

import { describeCloset, describePreferences } from "./describe";

describe("describePreferences", () => {
  it("turns answers into readable sentences", () => {
    expect(
      describePreferences({
        occasions: ["office", "evenings"],
        vibes: ["minimalist"],
        top_fit: "relaxed",
        bottom_fit: "straight",
        colors_love: ["navy"],
        colors_avoid: ["yellow"],
        comfort: 2,
        adventure: 4,
        notes: "I run cold",
      }),
    ).toEqual([
      "Dresses for: Office, Evenings out.",
      "Style directions: Minimalist (clean lines, few colors).",
      "Prefers relaxed tops and straight bottoms.",
      "Loves: navy.",
      "Avoids: yellow.",
      "Comfort vs. polish: mostly comfort.",
      "Appetite for trends: like to experiment.",
      'In their words: "I run cold"',
    ]);
  });

  it("leaves out unanswered questions", () => {
    expect(describePreferences({})).toEqual([]);
    expect(describePreferences({ top_fit: "fitted" })).toEqual(["Prefers fitted tops."]);
  });
});

describe("describeCloset", () => {
  it("summarizes counts, colors, tags and examples", () => {
    const lines = describeCloset([
      { category: "top", colors: ["navy", "white"], description: "Navy striped tee", style_tags: ["classic"] },
      { category: "top", colors: ["navy"], description: "Navy sweater", style_tags: ["classic"] },
      { category: "shoes", colors: ["white"], description: null, style_tags: [] },
    ]);
    expect(lines).toEqual([
      "Closet: 3 pieces. tops (2), shoes (1).",
      "Most common colors: navy (2), white (2).",
      "Most common style tags: classic (2).",
      "Pieces include: Navy striped tee; Navy sweater.",
    ]);
  });

  it("handles an empty closet", () => {
    expect(describeCloset([])).toEqual(["Closet: nothing added yet."]);
  });

  it("caps the number of examples", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      category: "top" as const,
      colors: [],
      description: `Item ${i}`,
      style_tags: [],
    }));
    expect(describeCloset(items, 3).at(-1)).toBe("Pieces include: Item 0; Item 1; Item 2.");
  });
});
