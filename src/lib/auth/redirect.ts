/**
 * Turns an untrusted `next` value (from a query string or form) into a safe
 * same-site path. Anything that could point off-site falls back to "/",
 * which prevents open redirects like `?next=//evil.example`.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  // "//host" and "/\host" are treated as protocol-relative URLs by browsers.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  // Control characters (tabs/newlines) can be stripped by browsers, turning
  // "/\t/evil.example" into "//evil.example".
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  if (next.startsWith("/login") || next.startsWith("/auth/")) return "/";
  return next;
}

/**
 * Supabase email links come back as `?code=…` (or `?error_description=…` when
 * expired). If one lands anywhere other than /auth/callback (e.g. Supabase fell
 * back to the Site URL), returns where to send it; otherwise null.
 */
export function emailLinkRedirect(pathname: string, search: URLSearchParams): string | null {
  if (pathname.startsWith("/auth/")) return null;

  if (search.has("error_description") || search.has("error_code")) return "/login?error=link";

  const code = search.get("code");
  if (!code) return null;

  const rest = new URLSearchParams(search);
  rest.delete("code");
  const query = rest.toString();
  const next = safeNextPath(pathname + (query ? `?${query}` : ""));
  return `/auth/callback?${new URLSearchParams({ code, next })}`;
}

/** Paths that don't require a signed-in user. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/manifest.webmanifest"
  );
}
