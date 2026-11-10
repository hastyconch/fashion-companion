"use server";

import { z } from "zod";

import { writeStyleSummary } from "@/lib/ai/style-summary";
import { mergePreferences, roundCoordinate } from "@/lib/profile/preferences";
import { runStyleSummary, type SummaryResult } from "@/lib/profile/summary-flow";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  return userId ? { supabase, userId } : null;
}

/** Saves one quiz step's answers, merged into what's already saved. */
export async function saveAnswers(patch: unknown): Promise<ActionResult> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "Sign in again." };
  const { supabase, userId } = session;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  const merged = mergePreferences(profile?.preferences, patch);
  if (!merged.ok) return merged;

  const { error } = await supabase.from("profiles").update({ preferences: merged.value }).eq("id", userId);
  return error ? { ok: false, error: "Couldn't save. Try again." } : { ok: true };
}

export async function saveName(name: string): Promise<ActionResult> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "Sign in again." };
  const clean = String(name ?? "").trim().slice(0, 80) || null;
  const { error } = await session.supabase
    .from("profiles")
    .update({ display_name: clean })
    .eq("id", session.userId);
  return error ? { ok: false, error: "Couldn't save. Try again." } : { ok: true };
}

const LocationSchema = z
  .object({
    city: z.string().trim().min(1).max(120),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().trim().max(64).nullable(),
  })
  .nullable();

/** Saves (or clears, with null) the location used for weather. */
export async function saveLocation(location: unknown): Promise<ActionResult> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "Sign in again." };
  const parsed = LocationSchema.safeParse(location);
  if (!parsed.success) return { ok: false, error: "That location didn't look right. Try another." };

  const loc = parsed.data;
  const { error } = await session.supabase
    .from("profiles")
    .update({
      city: loc?.city ?? null,
      latitude: loc ? roundCoordinate(loc.latitude) : null,
      longitude: loc ? roundCoordinate(loc.longitude) : null,
      timezone: loc?.timezone ?? null,
    })
    .eq("id", session.userId);
  return error ? { ok: false, error: "Couldn't save. Try again." } : { ok: true };
}

/** Asks the AI to write the style brief from the saved answers and closet. */
export async function generateSummary(): Promise<SummaryResult> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "Sign in again." };
  return runStyleSummary({ ...session, write: (context) => writeStyleSummary(context) });
}

/** Saves the user's own (or edited) style brief and marks the profile done. */
export async function saveSummary(memo: string): Promise<ActionResult> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "Sign in again." };
  const clean = String(memo ?? "").trim().slice(0, 800);
  const now = new Date().toISOString();
  const { error } = await session.supabase
    .from("profiles")
    .update({
      style_memo: clean || null,
      style_memo_updated_at: clean ? now : null,
      style_completed_at: now,
    })
    .eq("id", session.userId);
  return error ? { ok: false, error: "Couldn't save. Try again." } : { ok: true };
}
