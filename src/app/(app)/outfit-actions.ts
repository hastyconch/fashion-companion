"use server";

import { isUuid } from "@/lib/items/ids";
import { readPreferences } from "@/lib/profile/preferences";
import { targetWarmth, type StylableItem } from "@/lib/outfits/closet";
import { DISLIKE_REASONS } from "@/lib/outfits/occasions";
import { loadPiece, type OutfitPiece } from "@/lib/outfits/queries";
import { STYLABLE_COLUMNS } from "@/lib/outfits/suggest-flow";
import { pickSwap } from "@/lib/outfits/swap";
import { createClient } from "@/lib/supabase/server";
import type { Weather } from "@/lib/weather/open-meteo";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** 👍 / 👎 (with an optional reason), or "suggested" to undo. */
export async function reactToOutfit(
  outfitId: string,
  reaction: "liked" | "disliked" | "suggested",
  reason?: string | null,
): Promise<ActionResult> {
  if (!isUuid(outfitId) || !["liked", "disliked", "suggested"].includes(reaction)) {
    return { ok: false, error: "Outfit not found." };
  }
  const cleanReason =
    reaction === "disliked" && reason && (DISLIKE_REASONS as readonly string[]).includes(reason) ? reason : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outfits")
    .update({ status: reaction, feedback_reason: cleanReason })
    .eq("id", outfitId)
    .neq("status", "worn")
    .select("id");
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  if (!data.length) return { ok: false, error: "This outfit can't be changed now." };
  return { ok: true };
}

/** Marks the outfit as worn today and counts a wear for each piece. */
export async function wearOutfit(outfitId: string): Promise<ActionResult> {
  if (!isUuid(outfitId)) return { ok: false, error: "Outfit not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_outfit_worn", { p_outfit_id: outfitId });
  if (error || !data) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}

/**
 * Replaces one piece with the best alternative from the closet (no AI call).
 * `exclude` holds pieces already tried in this slot, so repeated taps cycle.
 */
export async function swapPiece(
  outfitId: string,
  itemId: string,
  exclude: string[] = [],
): Promise<{ ok: true; piece: OutfitPiece } | { ok: false; error: string }> {
  if (!isUuid(outfitId) || !isUuid(itemId)) return { ok: false, error: "Outfit not found." };
  const supabase = await createClient();

  const [outfitRes, linksRes, closetRes, profileRes] = await Promise.all([
    supabase.from("outfits").select("id, status, weather").eq("id", outfitId).maybeSingle(),
    supabase.from("outfit_items").select("item_id, position").eq("outfit_id", outfitId),
    supabase.from("items").select(STYLABLE_COLUMNS).eq("status", "active").eq("tag_status", "done"),
    supabase.from("profiles").select("preferences").maybeSingle(),
  ]);
  const outfit = outfitRes.data;
  if (!outfit || outfit.status === "worn") return { ok: false, error: "This outfit can't be changed now." };

  const links = linksRes.data ?? [];
  const closet = (closetRes.data ?? []) as StylableItem[];
  const byId = new Map(closet.map((i) => [i.id, i]));
  const link = links.find((l) => l.item_id === itemId);
  // The piece may have gone to the laundry since; look it up directly.
  const current =
    byId.get(itemId) ??
    ((await supabase.from("items").select(STYLABLE_COLUMNS).eq("id", itemId).maybeSingle()).data as
      | StylableItem
      | null);
  if (!link || !current) return { ok: false, error: "That piece isn't in this outfit." };

  const weather = outfit.weather as Weather | null;
  const replacement = pickSwap(
    links
      .map((l) => (l.item_id === current.id ? current : byId.get(l.item_id)))
      .filter((i): i is StylableItem => Boolean(i)),
    current,
    closet,
    {
      warmth: targetWarmth(weather ? (weather.feelsHigh + weather.feelsLow) / 2 : null),
      avoidColors: readPreferences(profileRes.data?.preferences).colors_avoid ?? [],
      now: new Date(),
      exclude: exclude.filter(isUuid),
    },
  );
  if (!replacement) return { ok: false, error: "No other options in your closet for this piece." };

  const { error: removeError } = await supabase
    .from("outfit_items")
    .delete()
    .eq("outfit_id", outfitId)
    .eq("item_id", itemId);
  if (removeError) return { ok: false, error: "Couldn't swap. Try again." };
  const { error: addError } = await supabase
    .from("outfit_items")
    .insert({ outfit_id: outfitId, item_id: replacement.id, position: link.position });
  if (addError) return { ok: false, error: "Couldn't swap. Try again." };

  const piece = await loadPiece(supabase, replacement.id);
  return piece ? { ok: true, piece } : { ok: false, error: "Couldn't swap. Try again." };
}
