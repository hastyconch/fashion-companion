import { describe, expect, it } from "vitest";

import { closetForAi, closetReadiness, targetWarmth, type StylableItem } from "./closet";
import { pickSwap } from "./swap";
import { checkOutfit } from "./validate";

const item = (id: string, category: StylableItem["category"], extra: Partial<StylableItem> = {}): StylableItem => ({
  id,
  category,
  subcategory: null,
  colors: [],
  pattern: "solid",
  material: null,
  formality: 3,
  warmth: 3,
  seasons: [],
  style_tags: [],
  description: `${category} ${id}`,
  last_worn_at: null,
  ...extra,
});

const tee = item("tee", "top", { formality: 2, warmth: 1 });
const shirt = item("shirt", "top", { formality: 4 });
const jeans = item("jeans", "bottom", { formality: 2 });
const trousers = item("trousers", "bottom", { formality: 4 });
const dress = item("dress", "dress");
const boots = item("boots", "shoes");
const coat = item("coat", "outerwear", { warmth: 5 });
const leggings = item("leggings", "activewear");
const sportsTop = item("sportstop", "activewear");
const ALL = [tee, shirt, jeans, trousers, dress, boots, coat, leggings, sportsTop];
const available = new Map(ALL.map((i) => [i.id, i]));

describe("closetForAi", () => {
  it("gives every item a short ref and keeps a map back to real ids", () => {
    const { lines, refToId, idToRef } = closetForAi([
      item("x1", "shoes", { description: "White sneakers", colors: ["white"] }),
      item("x2", "top", { description: "Navy tee", colors: ["navy"], seasons: ["summer"], style_tags: ["casual"] }),
    ]);
    // Tops sort before shoes.
    expect(lines[0]).toBe("i1: Navy tee (top; navy; formality 3/5; warmth 3/5; summer; casual)");
    expect(lines[1]).toMatch(/^i2: White sneakers \(shoes; white;/);
    expect(refToId.get("i1")).toBe("x2");
    expect(idToRef.get("x1")).toBe("i2");
  });
});

describe("closetReadiness", () => {
  it("is ready with a top, a bottom and shoes, or a dress and shoes", () => {
    expect(closetReadiness([tee, jeans, boots])).toEqual({ ready: true, missing: [] });
    expect(closetReadiness([dress, boots])).toEqual({ ready: true, missing: [] });
  });

  it("says what's missing", () => {
    expect(closetReadiness([tee, tee]).missing).toEqual([
      "a bottom (trousers, jeans, a skirt) or a dress",
      "a pair of shoes",
    ]);
    expect(closetReadiness([]).missing).toHaveLength(3);
  });
});

describe("checkOutfit", () => {
  const ok = (ids: string[], requireShoes = true) => checkOutfit(ids, available, { requireShoes });

  it("accepts complete outfits", () => {
    expect(ok(["tee", "jeans", "boots"])).toEqual({ ok: true, itemIds: ["tee", "jeans", "boots"] });
    expect(ok(["dress", "boots", "coat"]).ok).toBe(true);
    expect(ok(["tee", "shirt", "jeans", "boots"]).ok).toBe(true); // layered tops
    expect(ok(["sportstop", "leggings", "boots"]).ok).toBe(true);
    expect(ok(["tee", "leggings", "boots"]).ok).toBe(true);
  });

  it("rejects unknown pieces, so made-up ids can't slip through", () => {
    expect(ok(["tee", "jeans", "ghost"])).toEqual({ ok: false, reason: "unknown or unavailable piece" });
  });

  it("rejects incomplete or clashing outfits", () => {
    expect(ok(["tee", "boots"]).ok).toBe(false);
    expect(ok(["tee", "jeans"]).ok).toBe(false); // no shoes
    expect(ok(["tee", "jeans"], false).ok).toBe(true); // closet has no shoes at all
    expect(ok(["dress", "jeans", "boots"]).ok).toBe(false);
    expect(ok(["tee", "jeans", "trousers", "boots"]).ok).toBe(false);
    expect(ok(["sportstop", "boots"]).ok).toBe(false);
  });

  it("ignores duplicates", () => {
    expect(ok(["tee", "tee", "jeans", "boots"])).toEqual({ ok: true, itemIds: ["tee", "jeans", "boots"] });
  });
});

describe("pickSwap", () => {
  const ctx = { warmth: null, avoidColors: [], now: new Date("2026-11-13T12:00:00Z"), exclude: [] };

  it("swaps within the same category, matching the outfit's formality", () => {
    const outfit = [shirt, trousers, boots];
    expect(pickSwap(outfit, shirt, ALL, ctx)?.id).toBe("tee");
    const formalOutfit = [tee, trousers, boots, item("blazer", "outerwear", { formality: 5 })];
    const closet = [...ALL, item("polo", "top", { formality: 4 })];
    expect(pickSwap(formalOutfit, tee, closet, ctx)?.id).toBe("polo");
  });

  it("prefers pieces suited to the weather and away from avoided colors", () => {
    const a = item("warm", "top", { warmth: 5 });
    const b = item("cool", "top", { warmth: 1, colors: ["yellow"] });
    const c = item("cool2", "top", { warmth: 1 });
    const outfit = [shirt, jeans, boots];
    expect(pickSwap(outfit, shirt, [a, b, c], { ...ctx, warmth: 1, avoidColors: ["yellow"] })?.id).toBe("cool2");
  });

  it("avoids something worn yesterday and cycles through excluded options", () => {
    const worn = item("worn", "top", { formality: 4, last_worn_at: "2026-11-12T12:00:00Z" });
    const fresh = item("fresh", "top", { formality: 2 });
    const outfit = [shirt, jeans, boots];
    expect(pickSwap(outfit, shirt, [worn, fresh], ctx)?.id).toBe("fresh");
    expect(pickSwap(outfit, shirt, [worn, fresh], { ...ctx, exclude: ["fresh"] })?.id).toBe("worn");
    expect(pickSwap(outfit, shirt, [worn, fresh], { ...ctx, exclude: ["fresh", "worn"] })).toBeNull();
  });
});

describe("targetWarmth", () => {
  it("maps feels-like temperature to a 1–5 warmth", () => {
    expect([30, 20, 14, 7, -3].map(targetWarmth)).toEqual([1, 2, 3, 4, 5]);
    expect(targetWarmth(null)).toBeNull();
  });
});
