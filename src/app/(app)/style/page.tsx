import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { readPreferences } from "@/lib/profile/preferences";
import { createClient } from "@/lib/supabase/server";
import { StyleQuiz } from "./style-quiz";

export const metadata: Metadata = { title: "Your style" };

export default async function StylePage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login?next=/style");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, preferences, style_memo, style_keywords, city, style_completed_at")
    .eq("id", userId)
    .maybeSingle();

  return (
    <StyleQuiz
      initial={{
        name: profile?.display_name ?? "",
        preferences: readPreferences(profile?.preferences),
        city: profile?.city ?? null,
        memo: profile?.style_memo ?? null,
        keywords: profile?.style_keywords ?? [],
        completed: Boolean(profile?.style_completed_at),
      }}
    />
  );
}
