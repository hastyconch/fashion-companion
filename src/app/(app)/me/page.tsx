import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { readPreferences } from "@/lib/profile/preferences";
import { createClient } from "@/lib/supabase/server";
import { ChangePassword } from "./change-password";
import { StyleCard } from "./style-card";

export const metadata: Metadata = { title: "Me" };

export default async function MePage() {
  const supabase = await createClient();
  const [{ data: claims }, { data: profile }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("profiles")
      .select("display_name, style_memo, style_keywords, style_completed_at, city, preferences")
      .maybeSingle(),
  ]);

  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;
  const preferences = readPreferences(profile?.preferences);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Me" title={profile?.display_name || "Your profile"} />

      <StyleCard
        memo={profile?.style_memo ?? null}
        keywords={profile?.style_keywords ?? []}
        vibes={preferences.vibes ?? []}
        colors={preferences.colors_love ?? []}
        completed={Boolean(profile?.style_completed_at)}
      />

      <dl className="divide-y rounded-3xl border bg-surface">
        <div className="flex flex-col gap-0.5 px-5 py-4">
          <dt className="text-sm text-muted-foreground">Email</dt>
          <dd className="truncate text-sm">{email ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-sm text-muted-foreground">Weather location</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-sm">
              <MapPin className="size-3.5 shrink-0 text-accent" aria-hidden />
              <span className="truncate">{profile?.city ?? "Not set"}</span>
            </dd>
          </div>
          <Link
            href="/style?step=location"
            prefetch={false}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {profile?.city ? "Change" : "Set"}
          </Link>
        </div>
      </dl>

      <ChangePassword />
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </div>
  );
}
