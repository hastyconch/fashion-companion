import { afterEach, describe, expect, it, vi } from "vitest";

import { searchPlaces, toPlace } from "./geocoding";

afterEach(() => vi.unstubAllGlobals());

describe("toPlace", () => {
  it("builds a readable label and skips repeated parts", () => {
    expect(
      toPlace({ id: 1, name: "Lisbon", admin1: "Lisbon", country: "Portugal", latitude: 38.7, longitude: -9.1, timezone: "Europe/Lisbon" }),
    ).toEqual({ id: 1, label: "Lisbon, Portugal", latitude: 38.7, longitude: -9.1, timezone: "Europe/Lisbon" });
  });

  it("copes with missing region, country or timezone", () => {
    expect(toPlace({ id: 2, name: "Atlantis", latitude: 0, longitude: 0 }).label).toBe("Atlantis");
    expect(toPlace({ id: 2, name: "Atlantis", latitude: 0, longitude: 0 }).timezone).toBeNull();
  });
});

describe("searchPlaces", () => {
  it("doesn't search for very short queries", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await searchPlaces(" a ")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns places, or none when nothing matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ results: [{ id: 5, name: "Brooklyn", admin1: "New York", country: "United States", latitude: 40.65, longitude: -73.95, timezone: "America/New_York" }] })),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ generationtime_ms: 0.1 }))),
    );
    expect((await searchPlaces("brooklyn"))[0].label).toBe("Brooklyn, New York, United States");
    expect(await searchPlaces("zzzz")).toEqual([]);
  });

  it("reports failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    await expect(searchPlaces("paris")).rejects.toThrow(/500/);
  });
});
