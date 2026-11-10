import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create a new one per request; never share it across requests.
 */
export async function createClient() {
  // Session handling reads the clock (token expiry), which Next.js forbids
  // while prerendering. connection() marks everything after it request-time.
  await connection();
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies. That's fine: the proxy
          // (src/proxy.ts) refreshes the session before every page render.
        }
      },
    },
  });
}
