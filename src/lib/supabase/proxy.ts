import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { isPublicPath, safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "./env";

/**
 * Runs before every matched request: refreshes the Supabase session cookie
 * and sends signed-out visitors to /login.
 *
 * This is an optimistic check for a fast redirect. It is NOT the security
 * boundary: row-level security in Postgres is. Pages still verify the user.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Stops CDNs from caching a response that carries a session token.
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Don't put code between createServerClient and getClaims(): getClaims()
  // is what triggers the token refresh.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && request.nextUrl.pathname.startsWith("/api/")) {
    // API callers (fetch) need a status code, not an HTML login page.
    return copyCookies(
      response,
      NextResponse.json({ error: "Sign in again." }, { status: 401 }),
    );
  }

  if (!signedIn && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/") loginUrl.searchParams.set("next", next);
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (signedIn && request.nextUrl.pathname === "/login") {
    const target = new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url);
    return copyCookies(response, NextResponse.redirect(target));
  }

  return response;
}

/** Keeps refreshed/cleared session cookies when we swap in a redirect. */
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) to.headers.set("Cache-Control", cacheControl);
  return to;
}
