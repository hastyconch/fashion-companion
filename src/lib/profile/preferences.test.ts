import { describe, expect, it } from "vitest";

import { mergePreferences, readPreferences, roundCoordinate } from "./preferences";

describe("mergePreferences", () => {
  it("adds a step's answers to what's already saved", () => {
    expect(mergePreferences({ vibes: ["classic"] }, { occasions: ["office"] })).toEqual({
      ok: true,
      value: { vibes: ["classic"], occasions: ["office"] },
    });
  });

  it("replaces an answer that's saved again", () => {
    expect(mergePreferences({ vibes: ["classic"] }, { vibes: ["edgy", "vintage"] })).toEqual({
      ok: true,
      value: { vibes: ["edgy", "vintage"] },
    });
  });

  it("rejects values outside the vocabulary or limits", () => {
    expect(mergePreferences({}, { vibes: ["goth"] }).ok).toBe(false);
    expect(mergePreferences({}, { vibes: ["classic", "edgy", "vintage", "sporty"] }).ok).toBe(false);
    expect(mergePreferences({}, { comfort: 9 }).ok).toBe(false);
    expect(mergePreferences({}, { notes: "x".repeat(301) }).ok).toBe(false);
    expect(mergePreferences({}, { favorite: "pizza" }).ok).toBe(false);
  });

  it("keeps a color out of both lists at once, newest choice wins", () => {
    expect(
      mergePreferences({ colors_love: ["navy", "red"] }, { colors_avoid: ["red"] }),
    ).toEqual({ ok: true, value: { colors_love: ["navy"], colors_avoid: ["red"] } });
    expect(
      mergePreferences({ colors_avoid: ["red", "pink"] }, { colors_love: ["red"] }),
    ).toEqual({ ok: true, value: { colors_love: ["red"], colors_avoid: ["pink"] } });
  });

  it("drops corrupted stored data instead of failing the save", () => {
    expect(mergePreferences({ vibes: "not-a-list" }, { comfort: 3 })).toEqual({
      ok: true,
      value: { comfort: 3 },
    });
  });

  it("trims notes", () => {
    expect(mergePreferences({}, { notes: "  I run cold  " })).toEqual({
      ok: true,
      value: { notes: "I run cold" },
    });
  });
});

describe("readPreferences", () => {
  it("returns saved answers, or nothing when they're invalid", () => {
    expect(readPreferences({ comfort: 2 })).toEqual({ comfort: 2 });
    expect(readPreferences(null)).toEqual({});
    expect(readPreferences({ comfort: "high" })).toEqual({});
  });
});

describe("roundCoordinate", () => {
  it("rounds to two decimals", () => {
    expect(roundCoordinate(40.712776)).toBe(40.71);
    expect(roundCoordinate(-74.005974)).toBe(-74.01);
  });
});
