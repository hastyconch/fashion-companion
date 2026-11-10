import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { PageSkeleton } from "@/components/page-skeleton";
import { createClient } from "@/lib/supabase/server";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh md:pl-60">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-10 md:pt-12 md:pb-12">
        <Suspense fallback={<PageSkeleton />}>
          <RequireUser>{children}</RequireUser>
        </Suspense>
      </main>
    </div>
  );
}

/**
 * The proxy already redirects signed-out visitors; this is the server-side
 * check that page content never renders without a verified session.
 */
async function RequireUser({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return children;
}
