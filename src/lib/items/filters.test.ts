import { describe, expect, it } from "vitest";

import { hasActiveFilters, likePattern, parseClosetFilters } from "./filters";

describe("parseClosetFilters", () => {
  it("reads valid filters", () => {
    expect(
      parseClosetFilters({ category: "shoes", color: "light blue", season: "winter", status: "laundry", q: " boots " }),
    ).toEqual({ category: "shoes", color: "light blue", season: "winter", status: "laundry", q: "boots" });
  });

  it("drops values outside the vocabulary", () => {
    expect(
      parseClosetFilters({ category: "hats", color: "teal", season: "monsoon", status: "deleted" }),
    ).toEqual({ category: null, color: null, season: null, status: "all", q: "" });
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseClosetFilters({ category: ["top", "shoes"] }).category).toBe("top");
  });

  it("caps the search length", () => {
    expect(parseClosetFilters({ q: "x".repeat(500) }).q).toHaveLength(60);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the default view and true otherwise", () => {
    expect(hasActiveFilters(parseClosetFilters({}))).toBe(false);
    expect(hasActiveFilters(parseClosetFilters({ color: "black" }))).toBe(true);
  });
});

describe("likePattern", () => {
  it("escapes wildcards", () => {
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });
});
