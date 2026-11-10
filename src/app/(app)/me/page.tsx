import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ChangePassword } from "./change-password";

export const metadata: Metadata = { title: "Me" };

export default async function MePage() {
  const supabase = await createClient();
  const [{ data: claims }, { data: profile }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("profiles").select("display_name").maybeSingle(),
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
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <dt className="text-sm text-muted-foreground">Style profile</dt>
          <dd className="text-sm text-muted-foreground">Coming soon</dd>
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
