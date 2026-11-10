import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { AiError, MissingApiKeyError } from "@/lib/ai/client";
import { normalizeSummary } from "@/lib/ai/style-summary";
import { runStyleSummary } from "./summary-flow";

const USER = "00000000-0000-4000-8000-00000000a11c";
const NOW = new Date("2026-11-12T10:00:00Z");

function fakeSupabase(options: { quota?: boolean; preferences?: unknown } = {}) {
  const updates: Record<string, unknown>[] = [];
  const chain = (data: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      neq: () => q,
      order: () => q,
      limit: async () => ({ data, error: null }),
      maybeSingle: async () => ({ data, error: null }),
    };
    return q;
  };
  const supabase = {
    from: (table: string) => ({
      ...(table === "profiles"
        ? chain({ preferences: options.preferences ?? { vibes: ["minimalist"], colors_love: ["navy"] } })
        : chain([{ category: "top", colors: ["navy"], description: "Navy merino sweater", style_tags: ["classic"] }])),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(values);
          return { error: null };
        },
      }),
    }),
    rpc: vi.fn(async () => ({ data: options.quota ?? true, error: null })),
  };
  return { supabase: supabase as unknown as SupabaseClient, updates, rpc: supabase.rpc };
}

describe("runStyleSummary", () => {
  it("sends answers and closet to the writer and saves the result", async () => {
    const { supabase, updates, rpc } = fakeSupabase();
    const write = vi.fn(async () => ({
      summary: "  You keep things clean and navy.  ",
      keywords: ["Minimal", "navy", "navy", "relaxed tailoring"],
    }));
    const result = await runStyleSummary({ supabase, userId: USER, write, now: () => NOW });

    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", { p_kind: "style_summary", p_daily_limit: 20 });
    expect(write).toHaveBeenCalledWith({
      answers: ["Style directions: Minimalist (clean lines, few colors).", "Loves: navy."],
      closet: expect.arrayContaining(["Pieces include: Navy merino sweater."]),
    });
    expect(result).toEqual({
      ok: true,
      memo: "You keep things clean and navy.",
      keywords: ["minimal", "navy", "relaxed tailoring"],
    });
    expect(updates).toEqual([
      {
        style_memo: "You keep things clean and navy.",
        style_keywords: ["minimal", "navy", "relaxed tailoring"],
        style_memo_updated_at: NOW.toISOString(),
        style_completed_at: NOW.toISOString(),
      },
    ]);
  });

  it("stops at the daily limit without calling the AI", async () => {
    const { supabase } = fakeSupabase({ quota: false });
    const write = vi.fn();
    const result = await runStyleSummary({ supabase, userId: USER, write });
    expect(result.ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it("explains failures and saves nothing", async () => {
    for (const write of [
      vi.fn().mockRejectedValue(new MissingApiKeyError()),
      vi.fn().mockRejectedValue(new AiError("boom")),
      vi.fn().mockResolvedValue({ refused: true }),
    ]) {
      const { supabase, updates } = fakeSupabase();
      const result = await runStyleSummary({ supabase, userId: USER, write });
      expect(result).toMatchObject({ ok: false });
      expect(updates).toEqual([]);
    }
  });

  it("still works when the stored answers are corrupted", async () => {
    const { supabase } = fakeSupabase({ preferences: { vibes: "nope" } });
    const write = vi.fn<
      (context: { answers: string[]; closet: string[] }) => Promise<{ summary: string; keywords: string[] }>
    >(async () => ({ summary: "Fine.", keywords: [] }));
    await runStyleSummary({ supabase, userId: USER, write });
    expect(write.mock.calls[0]?.[0].answers).toEqual([]);
  });
});

describe("normalizeSummary", () => {
  it("caps the summary and keyword list to the column limits", () => {
    const out = normalizeSummary({ summary: "x".repeat(900), keywords: ["a", "b", "c", "d", "e", "f"] });
    expect(out.style_memo).toHaveLength(800);
    expect(out.style_keywords).toEqual(["a", "b", "c", "d", "e"]);
  });
});
