import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { photoUrl } from "@/lib/items/photos";
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

// One round trip: outfits, their pieces and each piece's item, embedded.
const OUTFIT_SELECT =
  "id, title, reason, tip, status, feedback_reason, occasion, for_date, weather, " +
  "outfit_items(position, items(id, description, category, thumb_path))";

type ItemRow = { id: string; description: string | null; category: Category | null; thumb_path: string };

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
  outfit_items: { position: number; items: ItemRow | null }[] | null;
};

/** Today's outfits for one occasion, in the order they were suggested. */
export async function loadOutfits(
  supabase: SupabaseClient,
  date: string,
  occasion: OutfitOccasion,
): Promise<OutfitView[]> {
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_SELECT)
    .eq("for_date", date)
    .eq("occasion", occasion)
    .order("created_at", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as OutfitRow[]).map(toView);
}

/** Outfits they liked or wore, newest first (the Looks page). */
export async function loadSavedLooks(supabase: SupabaseClient): Promise<OutfitView[]> {
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_SELECT)
    .in("status", ["liked", "worn"])
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return ((data ?? []) as unknown as OutfitRow[]).map(toView);
}

/** One piece, ready to show (used after a swap). */
export async function loadPiece(supabase: SupabaseClient, itemId: string): Promise<OutfitPiece | null> {
  const { data, error } = await supabase
    .from("items")
    .select("id, description, category, thumb_path")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !data) return null;
  return toPiece(data as ItemRow);
}

function toPiece(item: ItemRow): OutfitPiece {
  return {
    id: item.id,
    description: item.description,
    category: item.category,
    thumbUrl: photoUrl(item.thumb_path),
  };
}

function toView(o: OutfitRow): OutfitView {
  return {
    id: o.id,
    title: o.title,
    reason: o.reason,
    tip: o.tip,
    status: o.status,
    feedbackReason: o.feedback_reason,
    occasion: o.occasion,
    forDate: o.for_date,
    weather: o.weather,
    pieces: (o.outfit_items ?? [])
      .filter((link): link is { position: number; items: ItemRow } => Boolean(link.items))
      .sort((a, b) => a.position - b.position)
      .map((link) => toPiece(link.items))
      .sort((a, b) => order(a.category) - order(b.category)),
  };
}

function order(category: Category | null) {
  const i = category ? DISPLAY_ORDER.indexOf(category) : -1;
  return i === -1 ? DISPLAY_ORDER.length : i;
}
