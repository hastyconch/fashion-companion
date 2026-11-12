import { describe, expect, it } from "vitest";

import { localDateIn } from "./dates";

describe("localDateIn", () => {
  const lateEvening = new Date("2026-11-12T23:30:00Z");

  it("uses the time zone's calendar date", () => {
    expect(localDateIn("Europe/Lisbon", lateEvening)).toBe("2026-11-12");
    expect(localDateIn("Asia/Tokyo", lateEvening)).toBe("2026-11-13");
    expect(localDateIn("America/Los_Angeles", lateEvening)).toBe("2026-11-12");
  });

  it("returns null for missing or invalid zones", () => {
    expect(localDateIn(null)).toBeNull();
    expect(localDateIn("Mars/Olympus")).toBeNull();
    expect(localDateIn("x".repeat(100))).toBeNull();
  });
});
