import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { DuplicateCandidate, DuplicateVerdict } from "@/lib/ai/check-duplicate";
import { MAX_CANDIDATES, findDuplicate, rankCandidates } from "./duplicate-flow";

type Row = Record<string, unknown>;

const piece = (id: string, extra: Row = {}): Row => ({
  id, category: "top", subcategory: "t-shirt", colors: ["navy"], pattern: "solid", material: "cotton",
  description: `Tee ${id}`, thumb_path: `u/${id}/thumb.jpg`, tag_status: "done", duplicate_status: null, ...extra,
});

/** In-memory stand-in for the parts of the Supabase client findDuplicate uses. */
function fakeDb(rows: Row[], options: { quota?: boolean; signFails?: boolean } = {}) {
  const updates: { id: unknown; values: Row }[] = [];
  const rpc = vi.fn(async () => ({ data: options.quota ?? true, error: null }));
  const signed: string[][] = [];
  const from = () => {
    const filters: ((r: Row) => boolean)[] = [];
    let values: Row | null = null;
    let limit = Infinity;
    const run = () => ({ data: rows.filter((r) => filters.every((f) => f(r))).slice(0, limit), error: null });
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
      overlaps: (k: string, vs: unknown[]) => (filters.push((r) => (r[k] as unknown[]).some((x) => vs.includes(x))), q),
      order: () => q,
      limit: (n: number) => ((limit = n), q),
      maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
      update: (v: Row) => ((values = v), q),
      then: (resolve: (v: unknown) => void) => {
        if (values) {
          for (const r of run().data) {
            updates.push({ id: r.id, values });
            Object.assign(r, values);
          }
          return resolve({ error: null });
        }
        return resolve(run());
      },
    };
    return q;
  };
  const storage = {
    from: () => ({
      createSignedUrls: async (paths: string[]) => {
        signed.push(paths);
        if (options.signFails) return { data: null, error: new Error("nope") };
        return { data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}`, error: null })), error: null };
      },
    }),
  };
  return { supabase: { from, rpc, storage } as unknown as SupabaseClient, updates, rpc, signed };
}

function setup(rows: Row[], verdict: DuplicateVerdict | { refused: true }, options = {}) {
  const db = fakeDb(rows, options);
  const check = vi.fn<(url: string, c: DuplicateCandidate[]) => Promise<DuplicateVerdict | { refused: true }>>(
    async () => verdict,
  );
  return { ...db, check, run: () => findDuplicate("new", { supabase: db.supabase, check }) };
}

const SAME = (match: string): DuplicateVerdict => ({ verdict: "same", match, reason: " Same pocket and stitching. " });

describe("findDuplicate", () => {
  it("compares lookalikes by photo and saves a likely match as a question", async () => {
    const { run, check, updates, signed } = setup(
      [piece("new", { tag_status: "done" }), piece("old"), piece("shoes", { category: "shoes" }), piece("red", { colors: ["red"] })],
      SAME("c1"),
    );
    expect(await run()).toEqual({
      itemId: "old",
      description: "Tee old",
      thumbUrl: "/photos/u/old/thumb.jpg",
      reason: "Same pocket and stitching.",
    });
    // Only same-kind pieces sharing a color are sent, as thumbnails, never the new item itself.
    expect(signed).toEqual([["u/new/thumb.jpg", "u/old/thumb.jpg"]]);
    expect(check.mock.calls[0][1]).toEqual([{ ref: "c1", imageUrl: "https://signed/u/old/thumb.jpg", description: "Tee old" }]);
    expect(updates).toEqual([
      { id: "new", values: { duplicate_of: "old", duplicate_status: "pending", duplicate_reason: "Same pocket and stitching." } },
    ]);
  });

  it("asks nothing, and spends nothing, when no lookalike exists", async () => {
    const { run, check, rpc } = setup([piece("new"), piece("red", { colors: ["red"] }), piece("pending", { tag_status: "pending" })], SAME("c1"));
    expect(await run()).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  });

  it("only flags 'same', not merely similar pieces", async () => {
    const { run, updates } = setup([piece("new"), piece("old")], { verdict: "similar", match: "c1", reason: "Different collar." });
    expect(await run()).toBeNull();
    expect(updates).toEqual([]);
  });

  it("ignores refs the model made up", async () => {
    const { run, updates } = setup([piece("new"), piece("old")], SAME("c7"));
    expect(await run()).toBeNull();
    expect(updates).toEqual([]);
  });

  it("doesn't ask again once they've answered", async () => {
    const { run, check } = setup([piece("new", { duplicate_status: "different" }), piece("old")], SAME("c1"));
    expect(await run()).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it("drops an unanswered question when a re-tag finds no match", async () => {
    const { run, updates } = setup([piece("new", { duplicate_status: "pending", duplicate_of: "old" }), piece("old")], {
      verdict: "different",
      match: null,
      reason: "",
    });
    expect(await run()).toBeNull();
    expect(updates).toEqual([{ id: "new", values: { duplicate_of: null, duplicate_status: null, duplicate_reason: null } }]);
  });

  it("respects the daily limit and survives failures without throwing", async () => {
    expect(await setup([piece("new"), piece("old")], SAME("c1"), { quota: false }).run()).toBeNull();
    expect(await setup([piece("new"), piece("old")], SAME("c1"), { signFails: true }).run()).toBeNull();
    const broken = setup([piece("new"), piece("old")], SAME("c1"));
    broken.check.mockRejectedValueOnce(new Error("API down"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect(await broken.run()).toBeNull();
    expect(broken.updates).toEqual([]);
  });

  it(`sends at most ${MAX_CANDIDATES} lookalikes, and checks across related categories`, async () => {
    const many = Array.from({ length: 9 }, (_, n) => piece(`t${n}`));
    const { run, check } = setup([piece("new"), ...many, piece("jacket", { category: "outerwear", subcategory: "overshirt" })], SAME("c1"));
    await run();
    expect(check.mock.calls[0][1]).toHaveLength(MAX_CANDIDATES);
    const solo = setup([piece("new"), piece("jacket", { category: "outerwear" })], SAME("c1"));
    expect((await solo.run())?.itemId).toBe("jacket");
  });
});

describe("rankCandidates", () => {
  it("puts the closest match first: kind of piece, main color, pattern, fabric", () => {
    const item = { category: "top" as const, subcategory: "T-shirt", colors: ["navy", "white"], pattern: "striped", material: "cotton" };
    const rows = [
      piece("loose", { colors: ["white"], subcategory: "sweater", pattern: "solid", material: "wool" }),
      piece("close", { colors: ["navy", "white"], subcategory: "t-shirt", pattern: "striped" }),
      piece("jacket", { category: "outerwear", colors: ["navy"], subcategory: "jacket", pattern: null }),
      piece("unrelated", { colors: ["red"] }),
    ] as Parameters<typeof rankCandidates>[1];
    expect(rankCandidates(item, rows).map((r) => r.id)).toEqual(["close", "jacket", "loose"]);
  });
});
