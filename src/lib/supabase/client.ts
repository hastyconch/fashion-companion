import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/** Supabase client for Client Components. */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
