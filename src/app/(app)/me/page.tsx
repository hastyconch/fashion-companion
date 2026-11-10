import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ChangePassword } from "./change-password";

export const metadata: Metadata = { title: "Me" };

export default async function MePage() {
  const supabase = await createClient();
  const [{ data: claims }, { data: profile }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("profiles")
      .select("display_name, style_keywords, style_completed_at, city")
      .maybeSingle(),
  ]);

  const email = typeof claims?.claims.email === "string" ? claims.claims.email : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Me" title={profile?.display_name || "Your profile"} />
      <dl className="divide-y rounded-3xl border bg-surface">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <dt className="text-sm text-muted-foreground">Email</dt>
          <dd className="truncate text-sm">{email ?? "—"}</dd>
        </div>
        <div>
          <dt className="sr-only">Style profile</dt>
          <dd>
            <Link
              href="/style"
              className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 hover:bg-muted"
            >
              <span aria-hidden className="text-sm text-muted-foreground">
                Style profile
              </span>
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate">
                  {profile?.style_completed_at
                    ? profile.style_keywords?.length
                      ? profile.style_keywords.join(" · ")
                      : "Done"
                    : "Not set up yet"}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </span>
            </Link>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <dt className="text-sm text-muted-foreground">Weather location</dt>
          <dd className="truncate text-sm">{profile?.city ?? "Not set"}</dd>
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
