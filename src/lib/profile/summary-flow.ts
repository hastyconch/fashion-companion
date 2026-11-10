import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MissingApiKeyError } from "@/lib/ai/client";
import { normalizeSummary, type StyleSummary } from "@/lib/ai/style-summary";
import { describeCloset, describePreferences, type ClosetItemFacts } from "./describe";
import { readPreferences } from "./preferences";

export const DAILY_SUMMARY_LIMIT = 20;

export type SummaryResult =
  | { ok: true; memo: string; keywords: string[] }
  | { ok: false; error: string };

type Deps = {
  /** A per-request client acting as the signed-in user, so RLS applies. */
  supabase: SupabaseClient;
  userId: string;
  write: (context: { answers: string[]; closet: string[] }) => Promise<StyleSummary | { refused: true }>;
  now?: () => Date;
};

/** Writes the style brief from the saved answers and closet, then saves it. */
export async function runStyleSummary(deps: Deps): Promise<SummaryResult> {
  const { supabase, userId, write } = deps;
  const now = deps.now ?? (() => new Date());

  const [{ data: profile, error: profileError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle(),
      supabase
        .from("items")
        .select("category, colors, description, style_tags")
        .neq("status", "archived")
        .eq("tag_status", "done")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
  if (profileError || itemsError || !profile) {
    return { ok: false, error: "Couldn't load your answers. Try again." };
  }

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_kind: "style_summary",
    p_daily_limit: DAILY_SUMMARY_LIMIT,
  });
  if (quotaError) return { ok: false, error: "Couldn't check your usage. Try again." };
  if (!allowed) {
    return { ok: false, error: "You've hit today's limit for summaries. Write your own, or try tomorrow." };
  }

  let result: StyleSummary | { refused: true };
  try {
    result = await write({
      answers: describePreferences(readPreferences(profile.preferences)),
      closet: describeCloset((items ?? []) as ClosetItemFacts[]),
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return { ok: false, error: "The AI isn't set up yet (missing API key). Write your own for now." };
    }
    console.error("Style summary failed", { error });
    return { ok: false, error: "Couldn't write your summary this time. Try again, or write your own." };
  }

  if ("refused" in result) {
    return { ok: false, error: "Couldn't write a summary from these answers. Write your own below." };
  }

  const { style_memo, style_keywords } = normalizeSummary(result);
  const stamp = now().toISOString();
  const { error: saveError } = await supabase
    .from("profiles")
    .update({ style_memo, style_keywords, style_memo_updated_at: stamp, style_completed_at: stamp })
    .eq("id", userId);
  if (saveError) return { ok: false, error: "Couldn't save your summary. Try again." };

  return { ok: true, memo: style_memo, keywords: style_keywords };
}
