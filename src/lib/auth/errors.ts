/** Where an auth error happened, so the same Supabase error can read naturally. */
export type AuthContext = "password" | "email" | "code" | "change_password";

type AuthErrorLike = { code?: string | null; message?: string | null } | null | undefined;

/**
 * Turns a Supabase Auth error into a short, friendly sentence.
 * Prefers the machine-readable `code` and falls back to the message text.
 */
export function authErrorMessage(error: AuthErrorLike, context: AuthContext): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  const has = (...needles: string[]) =>
    needles.some((n) => code === n || message.includes(n.replace(/_/g, " ")));

  if (has("invalid_credentials", "invalid login credentials")) return "Wrong email or password.";
  if (has("email_not_confirmed")) return "This account hasn't been confirmed yet.";
  if (has("over_email_send_rate_limit") || (context === "email" && message.includes("rate limit"))) {
    return "Too many emails sent. Wait a few minutes and try again.";
  }
  if (has("over_request_rate_limit", "rate limit")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (has("signup_disabled", "user_not_found", "signups not allowed")) {
    return "This email doesn't have an account.";
  }
  if (has("weak_password")) return "Choose a stronger password: longer, with a mix of characters.";
  if (has("same_password")) return "That's already your password.";
  if (has("reauthentication_needed")) return "For security, sign out and back in, then try again.";
  if (context === "code" && has("otp_expired", "expired", "invalid")) {
    return "That code is wrong or has expired. Request a new one.";
  }
  return "Something went wrong. Please try again.";
}
