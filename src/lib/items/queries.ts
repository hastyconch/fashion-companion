import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { likePattern, type ClosetFilters } from "./filters";
import { photoUrl } from "./photos";
import type { Category, Color, ItemStatus, Pattern, Season } from "./vocabulary";

export type TagStatus = "pending" | "done" | "failed" | "not_clothing";

export type ClosetCard = {
  id: string;
  description: string | null;
  category: Category | null;
  status: ItemStatus;
  tag_status: TagStatus;
  thumbUrl: string | null;
};

export type ItemDetail = {
  id: string;
  image_path: string;
  thumb_path: string;
  status: ItemStatus;
  tag_status: TagStatus;
  category: Category | null;
  subcategory: string | null;
  colors: Color[];
  pattern: Pattern | null;
  material: string | null;
  formality: number | null;
  warmth: number | null;
  seasons: Season[];
  style_tags: string[];
  description: string | null;
  brand: string | null;
  wear_count: number;
  last_worn_at: string | null;
  created_at: string;
  imageUrl: string | null;
  thumbUrl: string | null;
};

/** The closet grid for the signed-in user (RLS scopes rows to them). */
export async function listClosetItems(
  supabase: SupabaseClient,
  filters: ClosetFilters,
): Promise<ClosetCard[]> {
  let query = supabase
    .from("items")
    .select("id, thumb_path, description, category, status, tag_status")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.color) query = query.contains("colors", [filters.color]);
  if (filters.season) query = query.contains("seasons", [filters.season]);
  if (filters.q) query = query.ilike("description", likePattern(filters.q));

  if (filters.status === "laundry") query = query.eq("status", "laundry");
  else if (filters.status === "archived") query = query.eq("status", "archived");
  else if (filters.status === "review") query = query.neq("tag_status", "done");
  else query = query.neq("status", "archived");

  const { data, error } = await query;
  if (error) throw error;
  return data.map((item) => ({
    id: item.id,
    description: item.description,
    category: item.category,
    status: item.status,
    tag_status: item.tag_status,
    thumbUrl: photoUrl(item.thumb_path),
  }));
}

export async function getItem(supabase: SupabaseClient, id: string): Promise<ItemDetail | null> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, image_path, thumb_path, status, tag_status, category, subcategory, colors, pattern, material, formality, warmth, seasons, style_tags, description, brand, wear_count, last_worn_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, imageUrl: photoUrl(data.image_path), thumbUrl: photoUrl(data.thumb_path) } as ItemDetail;
}

export async function countItems(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .neq("status", "archived");
  if (error) throw error;
  return count ?? 0;
}
