import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";

/**
 * No <Suspense> here on purpose: on Cloudflare Workers a streamed fallback
 * delayed the real content by ~0.5s. Pages render in one pass instead; taps on
 * the nav give instant feedback via useLinkStatus (see AppNav).
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // The proxy already redirects signed-out visitors; this is the server-side
  // check that page content never renders without a verified session.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <div className="min-h-dvh md:pl-60">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-10 md:pt-12 md:pb-12">
        {children}
      </main>
    </div>
  );
}
