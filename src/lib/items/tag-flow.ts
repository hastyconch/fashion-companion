import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MissingApiKeyError } from "@/lib/ai/client";
import type { TagOutcome } from "@/lib/ai/tag-item";
import { toTagColumns } from "./tags";

/** Generous for a personal closet session, and a hard stop for runaway costs. */
export const DAILY_TAG_LIMIT = 300;
const SIGNED_URL_SECONDS = 300;

export type TagFlowBody =
  | { status: "done"; description: string | null; category: string }
  | { status: "not_clothing" }
  | { status: "failed"; message: string };

export type TagFlowResult = { httpStatus: number; body: TagFlowBody | { error: string } };

type Deps = {
  /** A per-request client acting as the signed-in user, so RLS applies. */
  supabase: SupabaseClient;
  tag: (imageUrl: string) => Promise<TagOutcome>;
  now?: () => Date;
};

/** Tags one item end to end and records the outcome on its row. */
export async function runItemTagging(itemId: string, deps: Deps): Promise<TagFlowResult> {
  const { supabase, tag } = deps;
  const now = deps.now ?? (() => new Date());

  const { data: item, error: loadError } = await supabase
    .from("items")
    .select("id, image_path")
    .eq("id", itemId)
    .maybeSingle();
  if (loadError) return { httpStatus: 500, body: { error: "Couldn't load the item." } };
  if (!item) return { httpStatus: 404, body: { error: "Item not found." } };

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_kind: "tag_item",
    p_daily_limit: DAILY_TAG_LIMIT,
  });
  if (quotaError) return { httpStatus: 500, body: { error: "Couldn't check your usage." } };
  if (!allowed) {
    await markFailed();
    return {
      httpStatus: 429,
      body: { status: "failed", message: "Daily tagging limit reached. Try again tomorrow." },
    };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("closet")
    .createSignedUrl(item.image_path, SIGNED_URL_SECONDS);
  if (signError || !signed) {
    await markFailed();
    return { httpStatus: 500, body: { status: "failed", message: "Couldn't read the photo." } };
  }

  let outcome: TagOutcome;
  try {
    outcome = await tag(signed.signedUrl);
  } catch (error) {
    await markFailed();
    if (error instanceof MissingApiKeyError) {
      return {
        httpStatus: 503,
        body: { status: "failed", message: "Tagging isn't set up yet (missing API key)." },
      };
    }
    console.error("Tagging failed", { itemId, error });
    return {
      httpStatus: 502,
      body: { status: "failed", message: "Tagging didn't work this time. Try again." },
    };
  }

  if (outcome.kind === "refused") {
    await markFailed();
    return {
      httpStatus: 200,
      body: { status: "failed", message: "This photo couldn't be tagged. Add the details yourself." },
    };
  }

  if (outcome.kind === "not_clothing") {
    const { error } = await update({ tag_status: "not_clothing", tagged_at: now().toISOString() });
    if (error) return { httpStatus: 500, body: { error: "Couldn't save the result." } };
    return { httpStatus: 200, body: { status: "not_clothing" } };
  }

  const columns = toTagColumns(outcome.tags);
  const { error: saveError } = await update({
    ...columns,
    tag_status: "done",
    tagged_at: now().toISOString(),
  });
  if (saveError) {
    console.error("Saving tags failed", { itemId, saveError });
    await markFailed();
    return { httpStatus: 500, body: { status: "failed", message: "Couldn't save the tags." } };
  }

  return {
    httpStatus: 200,
    body: { status: "done", description: columns.description, category: columns.category },
  };

  function update(values: Record<string, unknown>) {
    return supabase.from("items").update(values).eq("id", itemId);
  }

  async function markFailed() {
    await update({ tag_status: "failed" });
  }
}
