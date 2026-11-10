import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it("explains a wrong password", () => {
    expect(authErrorMessage({ code: "invalid_credentials" }, "password")).toBe(
      "Wrong email or password.",
    );
    expect(authErrorMessage({ message: "Invalid login credentials" }, "password")).toBe(
      "Wrong email or password.",
    );
  });

  it("tells email and request rate limits apart", () => {
    expect(authErrorMessage({ code: "over_email_send_rate_limit" }, "email")).toMatch(/emails sent/);
    expect(authErrorMessage({ message: "Email rate limit exceeded" }, "email")).toMatch(/emails sent/);
    expect(authErrorMessage({ code: "over_request_rate_limit" }, "password")).toMatch(/attempts/);
  });

  it("says when an email has no account (sign-ups are off)", () => {
    expect(authErrorMessage({ code: "signup_disabled" }, "email")).toBe(
      "This email doesn't have an account.",
    );
    expect(authErrorMessage({ message: "Signups not allowed for otp" }, "email")).toBe(
      "This email doesn't have an account.",
    );
  });

  it("only blames the code for expiry when a code was entered", () => {
    expect(authErrorMessage({ code: "otp_expired" }, "code")).toMatch(/code is wrong or has expired/);
    expect(authErrorMessage({ code: "otp_expired" }, "password")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("covers password changes", () => {
    expect(authErrorMessage({ code: "weak_password" }, "change_password")).toMatch(/stronger/);
    expect(authErrorMessage({ code: "same_password" }, "change_password")).toMatch(/already/);
  });

  it("falls back to a generic message", () => {
    expect(authErrorMessage(null, "password")).toBe("Something went wrong. Please try again.");
    expect(authErrorMessage({ message: "socket hang up" }, "email")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
