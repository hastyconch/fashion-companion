import type { NextRequest } from "next/server";

import { suggestOutfits } from "@/lib/ai/suggest-outfits";
import { isOccasion } from "@/lib/outfits/occasions";
import { loadOutfits } from "@/lib/outfits/queries";
import { ensureOutfits } from "@/lib/outfits/suggest-flow";
import { createClient } from "@/lib/supabase/server";
import { fetchWeather } from "@/lib/weather/open-meteo";

/** The user's local date must be within a day of the server's (time zones). */
function isPlausibleDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(t) && Math.abs(t - Date.now()) <= 36 * 3600 * 1000;
}

/**
 * Returns today's outfits for an occasion, creating them on the first visit
 * (or on "new ideas"). A Route Handler so it can take its time without
 * blocking other actions on the page.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { date?: unknown; occasion?: unknown; refresh?: unknown }
    | null;
  if (!body || !isPlausibleDate(body.date) || !isOccasion(body.occasion)) {
    return Response.json({ status: "error", error: "Bad request." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return Response.json({ status: "error", error: "Sign in again." }, { status: 401 });

  const result = await ensureOutfits({
    supabase,
    date: body.date,
    occasion: body.occasion,
    refresh: body.refresh === true,
    suggest: (input) => suggestOutfits(input),
    weather: (lat, lon, date) => fetchWeather(lat, lon, date),
  });

  if (result.status === "not_ready") return Response.json(result);
  // Even when making new ones failed, show any outfits already saved for today.
  const outfits = await loadOutfits(supabase, body.date, body.occasion);
  if (result.status === "error") {
    return Response.json({ status: "error", error: result.error, outfits }, { status: outfits.length ? 200 : 502 });
  }
  return Response.json({ status: "ok", outfits });
}
