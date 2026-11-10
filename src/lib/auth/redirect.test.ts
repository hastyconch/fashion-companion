import { describe, expect, it } from "vitest";

import { isPublicPath, safeNextPath } from "./redirect";

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
