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

/** Paths that don't require a signed-in user. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname === "/manifest.webmanifest"
  );
}
