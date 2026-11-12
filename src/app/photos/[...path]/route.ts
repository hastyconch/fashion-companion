import type { NextRequest } from "next/server";

import { isPhotoPath } from "@/lib/items/photos";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Serves a closet photo at a URL that never changes, so the browser caches it
 * (private to this browser, for a year: item photos never change in place).
 *
 * Storage is fetched with the signed-in user's own token, so Storage's RLS
 * policies still decide access: you can only ever get your own photos. The
 * body is streamed straight through, not processed.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/photos/[...path]">) {
  const { path } = await ctx.params;
  const objectPath = path.join("/");
  if (!isPhotoPath(objectPath)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  // Refreshes an expired access token if needed (photo requests skip the proxy).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return new Response("Sign in again", { status: 401 });

  const { url, publishableKey } = getSupabaseEnv();
  const upstream = await fetch(`${url}/storage/v1/object/authenticated/closet/${objectPath}`, {
    headers: { authorization: `Bearer ${token}`, apikey: publishableKey },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: upstream.status === 400 || upstream.status === 403 ? 404 : upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "private, max-age=31536000, immutable",
      ...(upstream.headers.get("content-length") && { "content-length": upstream.headers.get("content-length")! }),
    },
  });
}
