import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { MissingApiKeyError } from "@/lib/ai/client";
import type { TagOutcome } from "@/lib/ai/tag-item";
import { TaggingError } from "@/lib/ai/tag-item";
import type { ItemTags } from "./tags";
import { runItemTagging } from "./tag-flow";

const ITEM_ID = "11111111-1111-4111-8111-11111111111a";
const NOW = new Date("2026-11-11T09:00:00Z");

const TAGS: ItemTags = {
  is_clothing: true,
  category: "top",
  subcategory: "t-shirt",
  colors: ["white"],
  pattern: "solid",
  material: "cotton",
  formality: 2,
  warmth: 1,
  seasons: ["spring", "summer"],
  style_tags: ["minimalist"],
  description: "White cotton crew-neck t-shirt",
  brand: null,
};

/** Just enough of the Supabase client for runItemTagging. */
function fakeSupabase(options: { item?: object | null; quota?: boolean; signError?: boolean } = {}) {
  const updates: Record<string, unknown>[] = [];
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: options.item === undefined ? { id: ITEM_ID, image_path: "u/i/full.jpg" } : options.item,
            error: null,
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(values);
          return { error: null };
        },
      }),
    }),
    rpc: vi.fn(async () => ({ data: options.quota ?? true, error: null })),
    storage: {
      from: () => ({
        createSignedUrl: async () =>
          options.signError
            ? { data: null, error: new Error("nope") }
            : { data: { signedUrl: "https://storage.example/signed" }, error: null },
      }),
    },
  };
  return { supabase: supabase as unknown as SupabaseClient, updates, rpc: supabase.rpc };
}

const tagWith = (outcome: TagOutcome) => vi.fn(async () => outcome);

describe("runItemTagging", () => {
  it("saves normalized tags and marks the item done", async () => {
    const { supabase, updates, rpc } = fakeSupabase();
    const tag = tagWith({ kind: "tagged", tags: TAGS });
    const result = await runItemTagging(ITEM_ID, { supabase, tag, now: () => NOW });

    expect(tag).toHaveBeenCalledWith("https://storage.example/signed");
    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", { p_kind: "tag_item", p_daily_limit: 300 });
    expect(result).toEqual({
      httpStatus: 200,
      body: { status: "done", description: "White cotton crew-neck t-shirt", category: "top" },
    });
    expect(updates).toEqual([
      expect.objectContaining({
        category: "top",
        colors: ["white"],
        tag_status: "done",
        tagged_at: NOW.toISOString(),
      }),
    ]);
  });

  it("returns 404 without spending quota when the item isn't visible", async () => {
    const { supabase, rpc } = fakeSupabase({ item: null });
    const result = await runItemTagging(ITEM_ID, { supabase, tag: tagWith({ kind: "refused" }) });
    expect(result.httpStatus).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("stops at the daily limit without calling the AI", async () => {
    const { supabase, updates } = fakeSupabase({ quota: false });
    const tag = tagWith({ kind: "tagged", tags: TAGS });
    const result = await runItemTagging(ITEM_ID, { supabase, tag });
    expect(result.httpStatus).toBe(429);
    expect(tag).not.toHaveBeenCalled();
    expect(updates).toEqual([{ tag_status: "failed" }]);
  });

  it("flags photos that aren't clothing", async () => {
    const { supabase, updates } = fakeSupabase();
    const result = await runItemTagging(ITEM_ID, {
      supabase,
      tag: tagWith({ kind: "not_clothing" }),
      now: () => NOW,
    });
    expect(result.body).toEqual({ status: "not_clothing" });
    expect(updates).toEqual([{ tag_status: "not_clothing", tagged_at: NOW.toISOString() }]);
  });

  it("marks the item failed when the AI errors, refuses or isn't configured", async () => {
    for (const [tag, status] of [
      [vi.fn().mockRejectedValue(new TaggingError("bad output")), 502],
      [vi.fn().mockRejectedValue(new MissingApiKeyError()), 503],
      [tagWith({ kind: "refused" }), 200],
    ] as const) {
      const { supabase, updates } = fakeSupabase();
      const result = await runItemTagging(ITEM_ID, { supabase, tag });
      expect(result.httpStatus).toBe(status);
      expect(result.body).toMatchObject({ status: "failed" });
      expect(updates).toEqual([{ tag_status: "failed" }]);
    }
  });

  it("fails cleanly when the photo can't be read", async () => {
    const { supabase, updates } = fakeSupabase({ signError: true });
    const tag = tagWith({ kind: "tagged", tags: TAGS });
    const result = await runItemTagging(ITEM_ID, { supabase, tag });
    expect(result.httpStatus).toBe(500);
    expect(tag).not.toHaveBeenCalled();
    expect(updates).toEqual([{ tag_status: "failed" }]);
  });
});
