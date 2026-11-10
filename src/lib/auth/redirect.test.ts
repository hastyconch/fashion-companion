import { describe, expect, it } from "vitest";

import { emailLinkRedirect, isPublicPath, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeNextPath("/closet")).toBe("/closet");
    expect(safeNextPath("/closet?color=black")).toBe("/closet?color=black");
  });

  it("falls back to / for empty or missing values", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects anything that can leave the site", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("never sends a signed-in user back into the auth flow", () => {
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/auth/confirm")).toBe("/");
  });
});

describe("isPublicPath", () => {
  it("allows the login and auth routes", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
  });

  it("protects the app", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/closet")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

describe("emailLinkRedirect", () => {
  const go = (url: string) => {
    const u = new URL(url, "https://app.example");
    return emailLinkRedirect(u.pathname, u.searchParams);
  };

  it("sends a stranded sign-in code to the callback, keeping where it landed", () => {
    expect(go("/?code=abc")).toBe("/auth/callback?code=abc&next=%2F");
    expect(go("/closet?code=abc&color=navy")).toBe(
      "/auth/callback?code=abc&next=%2Fcloset%3Fcolor%3Dnavy",
    );
  });

  it("leaves the callback itself and ordinary pages alone", () => {
    expect(go("/auth/callback?code=abc")).toBeNull();
    expect(go("/closet?color=navy")).toBeNull();
  });

  it("sends expired-link errors to the login page", () => {
    expect(go("/?error=access_denied&error_code=otp_expired&error_description=expired")).toBe(
      "/login?error=link",
    );
  });

  it("never turns a stranded code into an off-site redirect", () => {
    expect(go("//evil.example/?code=abc")).toBe("/auth/callback?code=abc&next=%2F");
  });
});
