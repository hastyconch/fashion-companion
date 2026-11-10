import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6 py-12">
      <header className="space-y-3">
        <p className="text-xs font-medium tracking-[0.25em] text-accent uppercase">
          Fashion Companion
        </p>
        <h1 className="font-display text-4xl leading-tight">
          Your closet,
          <br />
          styled for today.
        </h1>
        <p className="text-muted-foreground">
          Photograph what you own. Get outfits that suit you, the weather and
          the day ahead.
        </p>
      </header>
      <Suspense fallback={<div className="h-44 animate-pulse rounded-3xl bg-muted" />}>
        <LoginBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginBody({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next);

  return (
    <>
      {params.error === "link" && (
        <p role="alert" className="rounded-xl bg-muted px-4 py-3 text-sm">
          That sign-in link is invalid or has expired. Request a new code below.
        </p>
      )}
      <LoginForm next={next} />
    </>
  );
}
