import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { SuggestInput, Suggestions } from "@/lib/ai/suggest-outfits";
import type { Weather } from "@/lib/weather/open-meteo";
import { ensureOutfits } from "./suggest-flow";

type Row = Record<string, unknown>;

/** Tiny in-memory stand-in for the Supabase query builder. */
function fakeDb(tables: Record<string, Row[]>, quota = true) {
  const rpc = vi.fn(async () => ({ data: quota, error: null }));
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let mode: "select" | "delete" = "select";
    let limit = Infinity;
    const run = () => {
      const rows = (tables[table] ??= []);
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (mode === "delete") tables[table] = rows.filter((r) => !hit.includes(r));
      return { data: hit.slice(0, limit), error: null };
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      gte: (k: string, v: string) => (filters.push((r) => String(r[k]) >= v), q),
      lte: (k: string, v: string) => (filters.push((r) => String(r[k]) <= v), q),
      order: () => q,
      limit: (n: number) => ((limit = n), q),
      delete: () => ((mode = "delete"), q),
      maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
      insert: async (rows: Row[]) => {
        (tables[table] ??= []).push(...rows.map((r) => ({ status: "suggested", ...r })));
        return { error: null };
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    return q;
  };
  return { supabase: { from, rpc } as unknown as SupabaseClient, rpc };
}

const item = (id: string, category: string, extra: Row = {}) => ({
  id, category, subcategory: null, colors: [], pattern: "solid", material: null, formality: 3, warmth: 3,
  seasons: [], style_tags: [], description: `${category} ${id}`, last_worn_at: null, status: "active",
  tag_status: "done", ...extra,
});
const CLOSET = [item("tee", "top"), item("jeans", "bottom"), item("boots", "shoes"), item("coat", "outerwear")];
const WEATHER: Weather = { date: "2026-11-13", code: 61, high: 14, low: 8, feelsHigh: 12, feelsLow: 5, precipChance: 72, precipMm: 4, windKmh: 20, uv: 1 };

// closetForAi orders by category: top=i1, bottom=i2, outerwear=i3, shoes=i4.
const GOOD: Suggestions = {
  outfits: [
    { title: "Rainy layers", pieces: ["i1", "i2", "i3", "i4"], why: "Rain later.", tip: "Roll the cuffs." },
    { title: "Made up", pieces: ["i1", "i2", "i99"], why: "x", tip: "x" },
    { title: "Simple", pieces: ["i1", "i2", "i4"], why: "Easy.", tip: "Tuck it." },
  ],
};

function setup(extra: { tables?: Record<string, Row[]>; quota?: boolean; profile?: Row } = {}) {
  const tables: Record<string, Row[]> = {
    profiles: [{ preferences: { colors_avoid: ["yellow"] }, style_memo: "Relaxed navy.", latitude: 38.72, longitude: -9.13, ...extra.profile }],
    items: CLOSET,
    outfits: [],
    outfit_items: [],
    ...extra.tables,
  };
  const { supabase, rpc } = fakeDb(tables, extra.quota);
  const suggest = vi.fn<(input: SuggestInput) => Promise<Suggestions>>(async () => GOOD);
  const weather = vi.fn(async () => WEATHER);
  const run = (refresh = false) =>
    ensureOutfits({ supabase, date: "2026-11-13", occasion: "work", refresh, suggest, weather, now: () => new Date("2026-11-13T08:00:00Z") });
  return { tables, rpc, suggest, weather, run };
}

describe("ensureOutfits", () => {
  it("creates today's outfits from valid suggestions and drops made-up ones", async () => {
    const { tables, suggest, weather, run } = setup();
    expect(await run()).toEqual({ status: "ok", created: 2 });

    expect(weather).toHaveBeenCalledWith(38.72, -9.13, "2026-11-13");
    const input = suggest.mock.calls[0][0];
    expect(input.closet[0]).toMatch(/^i1: top tee/);
    expect(input.context).toEqual(
      expect.arrayContaining([
        "Their style brief: Relaxed navy.",
        "Avoids: yellow.",
        expect.stringMatching(/^Today: Friday, November 13\. Occasion: a day at work/),
        expect.stringMatching(/^Weather: Rain, high 14°C/),
        "Propose 3 outfits.",
      ]),
    );

    expect(tables.outfits.map((o) => o.title)).toEqual(["Rainy layers", "Simple"]);
    const first = tables.outfits[0];
    expect(tables.outfit_items.filter((p) => p.outfit_id === first.id).map((p) => p.item_id)).toEqual([
      "tee", "jeans", "coat", "boots",
    ]);
    expect(first.weather).toEqual(WEATHER);
  });

  it("reuses today's outfits without calling the AI again", async () => {
    const { suggest, rpc, run } = setup();
    await run();
    expect(await run()).toEqual({ status: "ok", created: 0 });
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("on refresh, replaces untouched suggestions but keeps ones they reacted to", async () => {
    const { tables, run } = setup();
    await run();
    tables.outfits[0].status = "liked";
    await run(true);
    expect(tables.outfits.map((o) => [o.title, o.status])).toEqual([
      ["Rainy layers", "liked"],
      ["Rainy layers", "suggested"],
      ["Simple", "suggested"],
    ]);
  });

  it("says what's missing instead of calling the AI when outfits aren't possible yet", async () => {
    const { rpc, suggest, run } = setup({ tables: { items: [item("tee", "top")] } });
    expect(await run()).toEqual({
      status: "not_ready",
      missing: ["a bottom (trousers, jeans, a skirt) or a dress", "a pair of shoes"],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(suggest).not.toHaveBeenCalled();
  });

  it("respects the daily limit", async () => {
    const { suggest, run } = setup({ quota: false });
    expect((await run()).status).toBe("error");
    expect(suggest).not.toHaveBeenCalled();
  });

  it("plans without weather when there's no location", async () => {
    const { weather, suggest, run } = setup({ profile: { latitude: null, longitude: null } });
    await run();
    expect(weather).not.toHaveBeenCalled();
    expect(suggest.mock.calls[0][0].context).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Weather: unknown \(no location set\)/)]),
    );
  });

  it("saves nothing when every suggestion is invalid", async () => {
    const { tables, suggest, run } = setup();
    suggest.mockResolvedValueOnce({ outfits: [{ title: "Bad", pieces: ["i1", "i42"], why: "", tip: "" }] });
    expect((await run()).status).toBe("error");
    expect(tables.outfits).toEqual([]);
  });

  it("feeds recent reactions back to the stylist", async () => {
    const { suggest, run } = setup({
      tables: {
        outfits: [{ id: "old", title: "Too sharp", status: "disliked", feedback_reason: "Too formal", for_date: "2026-11-12", occasion: "work" }],
        outfit_items: [{ outfit_id: "old", item_id: "tee" }, { outfit_id: "old", item_id: "boots" }],
      },
    });
    await run();
    expect(suggest.mock.calls[0][0].context).toEqual(
      expect.arrayContaining(['- Disliked "Too sharp" (i1, i4): "Too formal"']),
    );
  });

  it("tells the stylist what it suggested lately, and what it hasn't used", async () => {
    const shirt = item("shirt", "top");
    const { suggest, run } = setup({
      tables: {
        items: [...CLOSET, shirt],
        outfits: [
          { id: "a", title: "A", status: "suggested", for_date: "2026-11-12", occasion: "work" },
          { id: "b", title: "B", status: "suggested", for_date: "2026-11-11", occasion: "everyday" },
          { id: "old", title: "Old", status: "suggested", for_date: "2026-10-01", occasion: "work" },
        ],
        outfit_items: [
          { outfit_id: "a", item_id: "tee" }, { outfit_id: "a", item_id: "jeans" }, { outfit_id: "a", item_id: "boots" },
          { outfit_id: "b", item_id: "jeans" }, { outfit_id: "b", item_id: "tee" }, { outfit_id: "b", item_id: "boots" },
          { outfit_id: "old", item_id: "shirt" },
        ],
      },
    });
    await run();
    const { closet, context } = suggest.mock.calls[0][0];
    const ref = (id: string) => closet.find((l) => l.includes(`top ${id}`) || l.includes(` ${id} (`))!.split(":")[0];
    // The same three pieces in another order count as one combination; October is too old to matter.
    expect(context.filter((l) => l.startsWith("- "))).toEqual([expect.stringMatching(/^- Thu, Nov 12: /)]);
    expect(context).toContain("Suggested in the last two weeks (don't repeat these or near-copies):");
    const unused = context.find((l) => l.startsWith("Pieces you haven't suggested"))!;
    expect(unused).toContain(ref("shirt"));
    expect(unused).toContain(ref("coat"));
    expect(unused).not.toContain(`${ref("tee")},`);
  });

  it("drops repeats: duplicates within a batch and outfits suggested lately", async () => {
    const { tables, suggest, run } = setup({
      tables: {
        outfits: [{ id: "a", title: "Yesterday", status: "suggested", for_date: "2026-11-12", occasion: "work" }],
        outfit_items: [{ outfit_id: "a", item_id: "tee" }, { outfit_id: "a", item_id: "jeans" }, { outfit_id: "a", item_id: "boots" }],
      },
    });
    suggest.mockResolvedValueOnce({
      outfits: [
        { title: "Same as yesterday", pieces: ["i4", "i1", "i2"], why: "", tip: "" },
        { title: "Layers", pieces: ["i1", "i2", "i3", "i4"], why: "", tip: "" },
        { title: "Layers again", pieces: ["i4", "i3", "i2", "i1"], why: "", tip: "" },
      ],
    });
    expect(await run()).toEqual({ status: "ok", created: 1 });
    expect(tables.outfits.filter((o) => o.for_date === "2026-11-13").map((o) => o.title)).toEqual(["Layers"]);
  });

  it("keeps a repeat when every suggestion is one, rather than showing nothing", async () => {
    const { tables, suggest, run } = setup({
      tables: {
        outfits: [{ id: "a", title: "Yesterday", status: "suggested", for_date: "2026-11-12", occasion: "work" }],
        outfit_items: [{ outfit_id: "a", item_id: "tee" }, { outfit_id: "a", item_id: "jeans" }, { outfit_id: "a", item_id: "boots" }],
      },
    });
    suggest.mockResolvedValueOnce({ outfits: [{ title: "Again", pieces: ["i1", "i2", "i4"], why: "", tip: "" }] });
    expect(await run()).toEqual({ status: "ok", created: 1 });
    expect(tables.outfits.at(-1)?.title).toBe("Again");
  });

  it("on refresh, tells the stylist what it just showed", async () => {
    const { suggest, run } = setup();
    await run();
    await run(true);
    const context = suggest.mock.calls[1][0].context;
    expect(context).toContain("Suggested in the last two weeks (don't repeat these or near-copies):");
    expect(context.filter((l) => l.startsWith("- Fri, Nov 13: "))).toHaveLength(2);
  });
});
