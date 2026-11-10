import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Category } from "@/lib/items/vocabulary";
import type { Weather } from "@/lib/weather/open-meteo";
import type { OutfitOccasion } from "./occasions";

export type OutfitPiece = {
  id: string;
  description: string | null;
  category: Category | null;
  thumbUrl: string | null;
};

export type OutfitStatus = "suggested" | "liked" | "disliked" | "worn";

export type OutfitView = {
  id: string;
  title: string;
  reason: string | null;
  tip: string | null;
  status: OutfitStatus;
  feedbackReason: string | null;
  occasion: OutfitOccasion;
  forDate: string;
  weather: Weather | null;
  pieces: OutfitPiece[];
};

// Outer layer first, shoes and extras last, so every outfit reads the same way.
const DISPLAY_ORDER: Category[] = [
  "outerwear", "top", "dress", "activewear", "bottom", "shoes", "bag", "accessory", "other",
];

const OUTFIT_COLUMNS = "id, title, reason, tip, status, feedback_reason, occasion, for_date, weather";

type OutfitRow = {
  id: string;
  title: string;
  reason: string | null;
  tip: string | null;
  status: OutfitStatus;
  feedback_reason: string | null;
  occasion: OutfitOccasion;
  for_date: string;
  weather: Weather | null;
};

/** Today's outfits for one occasion, in the order they were suggested. */
export async function loadOutfits(
  supabase: SupabaseClient,
  date: string,
  occasion: OutfitOccasion,
): Promise<OutfitView[]> {
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_COLUMNS)
    .eq("for_date", date)
    .eq("occasion", occasion)
    .order("created_at", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return withPieces(supabase, (data ?? []) as OutfitRow[]);
}

/** Outfits they liked or wore, newest first (the Looks page). */
export async function loadSavedLooks(supabase: SupabaseClient): Promise<OutfitView[]> {
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_COLUMNS)
    .in("status", ["liked", "worn"])
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return withPieces(supabase, (data ?? []) as OutfitRow[]);
}

/** One piece, ready to show (used after a swap). */
export async function loadPiece(supabase: SupabaseClient, itemId: string): Promise<OutfitPiece | null> {
  const [piece] = await piecesFor(supabase, [itemId]);
  return piece ?? null;
}

async function withPieces(supabase: SupabaseClient, outfits: OutfitRow[]): Promise<OutfitView[]> {
  if (!outfits.length) return [];
  const { data: links, error } = await supabase
    .from("outfit_items")
    .select("outfit_id, item_id, position")
    .in("outfit_id", outfits.map((o) => o.id))
    .order("position", { ascending: true });
  if (error) throw error;

  const pieces = new Map(
    (await piecesFor(supabase, [...new Set((links ?? []).map((l) => l.item_id as string))])).map((p) => [p.id, p]),
  );
  return outfits.map((o) => ({
    id: o.id,
    title: o.title,
    reason: o.reason,
    tip: o.tip,
    status: o.status,
    feedbackReason: o.feedback_reason,
    occasion: o.occasion,
    forDate: o.for_date,
    weather: o.weather,
    pieces: (links ?? [])
      .filter((l) => l.outfit_id === o.id)
      .map((l) => pieces.get(l.item_id))
      .filter((p): p is OutfitPiece => Boolean(p))
      .sort((a, b) => order(a.category) - order(b.category)),
  }));
}

function order(category: Category | null) {
  const i = category ? DISPLAY_ORDER.indexOf(category) : -1;
  return i === -1 ? DISPLAY_ORDER.length : i;
}

async function piecesFor(supabase: SupabaseClient, ids: string[]): Promise<OutfitPiece[]> {
  if (!ids.length) return [];
  const { data: items, error } = await supabase
    .from("items")
    .select("id, description, category, thumb_path")
    .in("id", ids);
  if (error) throw error;
  const { data: signed } = await supabase.storage
    .from("closet")
    .createSignedUrls((items ?? []).map((i) => i.thumb_path), 60 * 60);
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return (items ?? []).map((i) => ({
    id: i.id,
    description: i.description,
    category: i.category,
    thumbUrl: urls.get(i.thumb_path) ?? null,
  }));
}
