import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { MissingApiKeyError } from "@/lib/ai/client";
import type { SuggestInput, Suggestions } from "@/lib/ai/suggest-outfits";
import { describePreferences } from "@/lib/profile/describe";
import { readPreferences } from "@/lib/profile/preferences";
import { describeWeather, type Weather } from "@/lib/weather/open-meteo";
import { closetForAi, closetReadiness, type StylableItem } from "./closet";
import { OUTFIT_OCCASIONS, type OutfitOccasion } from "./occasions";
import { checkOutfit } from "./validate";
import { VARIETY_DAYS, daysBefore, describeVariety, piecesKey } from "./variety";

export const DAILY_SUGGEST_LIMIT = 30;
const MAX_OUTFITS = 3;

export const STYLABLE_COLUMNS =
  "id, category, subcategory, colors, pattern, material, formality, warmth, seasons, style_tags, description, last_worn_at";

export type EnsureResult =
  | { status: "ok"; created: number }
  | { status: "not_ready"; missing: string[] }
  | { status: "error"; error: string };

type Deps = {
  /** A per-request client acting as the signed-in user, so RLS applies. */
  supabase: SupabaseClient;
  date: string; // user's local YYYY-MM-DD
  occasion: OutfitOccasion;
  /** Replace today's unreacted suggestions with new ones. */
  refresh: boolean;
  suggest: (input: SuggestInput) => Promise<Suggestions | { refused: true }>;
  weather: (latitude: number, longitude: number, date: string) => Promise<Weather | null>;
  now?: () => Date;
};

/**
 * Makes sure today's outfits exist for an occasion. Existing ones are reused,
 * so reopening the app costs nothing; new ones are only made on first visit
 * or when the user asks for new ideas.
 */
export async function ensureOutfits(deps: Deps): Promise<EnsureResult> {
  const { supabase, date, occasion, refresh } = deps;
  const now = deps.now ?? (() => new Date());

  const { data: existing, error: existingError } = await supabase
    .from("outfits")
    .select("id, status")
    .eq("for_date", date)
    .eq("occasion", occasion);
  if (existingError) return { status: "error", error: "Couldn't load today's outfits." };
  if (!refresh && existing.length > 0) return { status: "ok", created: 0 };

  const [profileRes, itemsRes, historyRes, recentRes] = await Promise.all([
    supabase.from("profiles").select("preferences, style_memo, latitude, longitude").maybeSingle(),
    supabase
      .from("items")
      .select(STYLABLE_COLUMNS)
      .eq("status", "active")
      .eq("tag_status", "done")
      .limit(400),
    supabase
      .from("outfits")
      .select("id, title, status, feedback_reason")
      .in("status", ["liked", "disliked", "worn"])
      .order("updated_at", { ascending: false })
      .limit(12),
    // Everything suggested lately, reacted to or not, so the stylist doesn't repeat itself.
    supabase
      .from("outfits")
      .select("id, for_date")
      .gte("for_date", daysBefore(date, VARIETY_DAYS))
      .lte("for_date", date)
      .order("for_date", { ascending: false })
      .limit(60),
  ]);
  if (profileRes.error || itemsRes.error || historyRes.error || recentRes.error) {
    return { status: "error", error: "Couldn't load your closet." };
  }

  const items = (itemsRes.data ?? []) as StylableItem[];
  const readiness = closetReadiness(items);
  if (!readiness.ready) return { status: "not_ready", missing: readiness.missing };

  const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
    p_kind: "suggest_outfits",
    p_daily_limit: DAILY_SUGGEST_LIMIT,
  });
  if (quotaError) return { status: "error", error: "Couldn't check your usage." };
  if (!allowed) return { status: "error", error: "You've asked for a lot of outfits today. More tomorrow!" };

  const profile = profileRes.data;
  const weather =
    profile?.latitude != null && profile?.longitude != null
      ? await deps.weather(profile.latitude, profile.longitude, date)
      : null;

  const { lines, refToId, idToRef } = closetForAi(items, date);
  const historyOutfits = historyRes.data ?? [];
  const recentOutfits = recentRes.data ?? [];
  const piecesOf = await loadPieces(supabase, [...historyOutfits, ...recentOutfits].map((o) => o.id));
  const history = describeHistory(historyOutfits, piecesOf, idToRef);
  const variety = describeVariety(
    recentOutfits.map((o) => ({ for_date: o.for_date, itemIds: piecesOf.get(o.id) ?? [] })),
    items,
    idToRef,
  );
  const recentlyWorn = items
    .filter((i) => i.last_worn_at && now().getTime() - new Date(i.last_worn_at).getTime() < 3 * 86_400_000)
    .map((i) => idToRef.get(i.id));

  const answers = describePreferences(readPreferences(profile?.preferences));
  const context = [
    profile?.style_memo ? `Their style brief: ${profile.style_memo}` : "They haven't written a style brief yet.",
    ...(answers.length ? ["Their answers:", ...answers] : []),
    `Today: ${formatDate(date)}. Occasion: ${OUTFIT_OCCASIONS[occasion].brief}.`,
    weather
      ? `Weather: ${describeWeather(weather)}`
      : `Weather: unknown (no location set). Assume a typical ${season(date)} day in the Northern Hemisphere.`,
    recentlyWorn.length ? `Worn in the last 3 days: ${recentlyWorn.join(", ")}.` : "Nothing worn recently.",
    ...(history.length ? ["Their recent reactions:", ...history] : []),
    ...variety.lines,
    `Propose ${MAX_OUTFITS} outfits.`,
  ];

  let result: Suggestions | { refused: true };
  try {
    result = await deps.suggest({ closet: lines, context });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return { status: "error", error: "The AI isn't set up yet (missing API key)." };
    }
    console.error("Outfit suggestions failed", { error });
    return { status: "error", error: "Couldn't put outfits together this time. Try again." };
  }
  if ("refused" in result) return { status: "error", error: "Couldn't suggest outfits right now." };

  // Never trust the model: map refs back to real items and check every outfit.
  const available = new Map(items.map((i) => [i.id, i]));
  const requireShoes = items.some((i) => i.category === "shoes");
  const valid = result.outfits
    .map((o) => ({
      ...o,
      check: checkOutfit(
        o.pieces.map((ref) => refToId.get(ref.trim())).filter((id): id is string => Boolean(id)),
        available,
        { requireShoes },
      ),
    }))
    .filter((o) => o.check.ok);
  // Drop repeats within the batch, then prefer outfits not suggested lately
  // (unless every one is a repeat: an old outfit beats none).
  const seen = new Set<string>();
  const distinct = valid.filter((o) => {
    if (!o.check.ok) return false;
    const key = piecesKey(o.check.itemIds);
    return seen.has(key) ? false : (seen.add(key), true);
  });
  const fresh = distinct.filter((o) => o.check.ok && !variety.recentKeys.has(piecesKey(o.check.itemIds)));
  const chosen = (fresh.length ? fresh : distinct).slice(0, MAX_OUTFITS);
  if (!chosen.length) return { status: "error", error: "Couldn't put outfits together this time. Try again." };

  if (refresh) {
    // Keep outfits they reacted to; replace the rest.
    const stale = existing.filter((o) => o.status === "suggested").map((o) => o.id);
    if (stale.length) await supabase.from("outfits").delete().in("id", stale);
  }

  // Ids are generated here so each outfit and its pieces are linked exactly.
  const planned = chosen.map((o, i) => ({
    id: crypto.randomUUID(),
    for_date: date,
    occasion,
    position: i,
    title: o.title.trim().slice(0, 80),
    reason: o.why.trim().slice(0, 400),
    tip: o.tip.trim().slice(0, 200),
    weather,
  }));
  const { error: insertError } = await supabase.from("outfits").insert(planned);
  if (insertError) return { status: "error", error: "Couldn't save today's outfits." };

  const pieces = planned.flatMap((row, i) => {
    const check = chosen[i].check;
    return check.ok ? check.itemIds.map((itemId, position) => ({ outfit_id: row.id, item_id: itemId, position })) : [];
  });
  const { error: piecesError } = await supabase.from("outfit_items").insert(pieces);
  if (piecesError) return { status: "error", error: "Couldn't save today's outfits." };

  return { status: "ok", created: chosen.length };
}

/** Each outfit's pieces, in one query. */
async function loadPieces(supabase: SupabaseClient, outfitIds: string[]): Promise<Map<string, string[]>> {
  const pieces = new Map<string, string[]>();
  const ids = [...new Set(outfitIds)];
  if (!ids.length) return pieces;
  const { data } = await supabase.from("outfit_items").select("outfit_id, item_id").in("outfit_id", ids);
  for (const row of data ?? []) pieces.set(row.outfit_id, [...(pieces.get(row.outfit_id) ?? []), row.item_id]);
  return pieces;
}

function describeHistory(
  outfits: { id: string; title: string; status: string; feedback_reason: string | null }[],
  piecesOf: Map<string, string[]>,
  idToRef: Map<string, string>,
): string[] {
  const verb: Record<string, string> = { liked: "Liked", disliked: "Disliked", worn: "Wore" };
  return outfits.map((o) => {
    const pieces = (piecesOf.get(o.id) ?? []).map((id) => idToRef.get(id)).filter(Boolean).join(", ");
    const reason = o.feedback_reason ? `: "${o.feedback_reason}"` : "";
    return `- ${verb[o.status] ?? o.status} "${o.title}"${pieces ? ` (${pieces})` : ""}${reason}`;
  });
}

function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function season(date: string): string {
  const month = Number(date.slice(5, 7));
  return month <= 2 || month === 12 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
}
