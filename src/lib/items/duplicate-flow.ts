import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DuplicateCandidate, DuplicateVerdict } from "@/lib/ai/check-duplicate";
import { photoUrl } from "./photos";
import type { Category } from "./vocabulary";

/** Matches the tagging limit: at most one check per item added. */
export const DAILY_DUPLICATE_LIMIT = 300;
/** Enough to cover a closet's lookalikes, few enough to keep each check cheap. */
export const MAX_CANDIDATES = 6;
const SIGNED_URL_SECONDS = 300;

/** Pieces the tagger can file under either category (an overshirt, a track top). */
const RELATED: Partial<Record<Category, Category[]>> = {
  top: ["outerwear", "activewear"],
  outerwear: ["top"],
  bottom: ["activewear"],
  activewear: ["top", "bottom"],
};

export type DuplicateMatch = {
  itemId: string;
  description: string | null;
  thumbUrl: string | null;
  reason: string;
};

type ItemFacts = {
  id: string;
  category: Category | null;
  subcategory: string | null;
  colors: string[];
  pattern: string | null;
  material: string | null;
  description: string | null;
  thumb_path: string;
};

type Deps = {
  /** A per-request client acting as the signed-in user, so RLS applies. */
  supabase: SupabaseClient;
  check: (newImageUrl: string, candidates: DuplicateCandidate[]) => Promise<DuplicateVerdict | { refused: true }>;
};

const FACT_COLUMNS = "id, category, subcategory, colors, pattern, material, description, thumb_path";

/**
 * After tagging, looks for an item the user already owns that this new one
 * might be. Cheap tag matching picks a few lookalikes; only then does the AI
 * compare photos. A likely match is saved as a pending question on the new
 * item. Never throws: a failed check just means no question.
 */
export async function findDuplicate(itemId: string, deps: Deps): Promise<DuplicateMatch | null> {
  const { supabase } = deps;
  try {
    const { data: item } = await supabase
      .from("items")
      .select(`${FACT_COLUMNS}, duplicate_status`)
      .eq("id", itemId)
      .maybeSingle();
    if (!item?.category || !item.colors?.length) return null;
    // They already answered for this item; don't ask again after a re-tag.
    if (item.duplicate_status === "similar" || item.duplicate_status === "different") return null;

    const { data: rows, error } = await supabase
      .from("items")
      .select(FACT_COLUMNS)
      .in("category", [item.category, ...(RELATED[item.category as Category] ?? [])])
      .overlaps("colors", item.colors)
      .eq("tag_status", "done")
      .neq("id", itemId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) return null;

    const candidates = rankCandidates(item, rows ?? []).slice(0, MAX_CANDIDATES);
    if (!candidates.length) return clear(item.duplicate_status);

    const { data: allowed } = await supabase.rpc("consume_ai_quota", {
      p_kind: "check_duplicate",
      p_daily_limit: DAILY_DUPLICATE_LIMIT,
    });
    if (!allowed) return null;

    // Thumbnails are plenty to compare details, and keep the call cheap.
    const { data: signed, error: signError } = await supabase.storage
      .from("closet")
      .createSignedUrls([item.thumb_path, ...candidates.map((c) => c.thumb_path)], SIGNED_URL_SECONDS);
    const urls = (signed ?? []).map((s) => s.signedUrl);
    if (signError || urls.length !== candidates.length + 1 || urls.some((u) => !u)) return null;
    const [newUrl, ...candidateUrls] = urls as string[];

    // The model only sees short refs; map its answer back here, never trust an id from it.
    const byRef = new Map(candidates.map((c, i) => [`c${i + 1}`, c]));
    const verdict = await deps.check(
      newUrl,
      candidates.map((c, i) => ({ ref: `c${i + 1}`, imageUrl: candidateUrls[i], description: c.description })),
    );
    if ("refused" in verdict || verdict.verdict !== "same") return clear(item.duplicate_status);
    const match = byRef.get(verdict.match?.trim() ?? "");
    if (!match) return clear(item.duplicate_status);

    const reason = verdict.reason.trim().slice(0, 200);
    const { error: saveError } = await supabase
      .from("items")
      .update({ duplicate_of: match.id, duplicate_status: "pending", duplicate_reason: reason })
      .eq("id", itemId);
    if (saveError) return null;
    return { itemId: match.id, description: match.description, thumbUrl: photoUrl(match.thumb_path), reason };
  } catch (error) {
    console.error("Duplicate check failed", { itemId, error });
    return null;
  }

  /** A re-tag that no longer finds a match drops the old, unanswered question. */
  async function clear(status: string | null) {
    if (status === "pending") {
      await supabase
        .from("items")
        .update({ duplicate_of: null, duplicate_status: null, duplicate_reason: null })
        .eq("id", itemId);
    }
    return null;
  }
}

/** Most alike first: same kind of piece, same main color, same pattern and fabric. */
export function rankCandidates<T extends ItemFacts>(
  item: Pick<ItemFacts, "category" | "subcategory" | "colors" | "pattern" | "material">,
  rows: T[],
): T[] {
  const norm = (s: string | null) => s?.trim().toLowerCase() || null;
  const score = (row: ItemFacts) => {
    const shared = row.colors.filter((c) => item.colors.includes(c)).length;
    let s = shared * 2;
    if (row.category === item.category) s += 2;
    if (row.colors[0] && row.colors[0] === item.colors[0]) s += 2;
    if (norm(row.subcategory) && norm(row.subcategory) === norm(item.subcategory)) s += 3;
    if (norm(row.pattern) && norm(row.pattern) === norm(item.pattern)) s += 1;
    if (norm(row.material) && norm(row.material) === norm(item.material)) s += 1;
    return s;
  };
  return rows
    .filter((row) => row.colors.some((c) => item.colors.includes(c)))
    .map((row, index) => ({ row, index, score: score(row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ row }) => row);
}
