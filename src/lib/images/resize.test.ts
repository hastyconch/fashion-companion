import { describe, expect, it } from "vitest";

import { fitWithin } from "./resize";

describe("fitWithin", () => {
  it("scales landscape and portrait photos by their longest side", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales small photos", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("handles extreme aspect ratios without collapsing to zero", () => {
    expect(fitWithin(10000, 10, 480)).toEqual({ width: 480, height: 1 });
  });

  it("rejects images with no size", () => {
    expect(() => fitWithin(0, 100, 480)).toThrow();
  });
});
