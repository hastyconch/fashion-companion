"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6,10}$/;

/**
 * One action drives both steps of the form (send code, then verify it),
 * so the client component stays a thin useActionState wrapper.
 */
export async function loginAction(
  previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "");

  if (intent === "restart") return { step: "email", email: "" };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return { step: "email", email, error: "Enter a valid email address." };
  }

  const supabase = await createClient();

  if (intent === "send") {
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: origin ? { emailRedirectTo: origin } : undefined,
    });
    if (error) return { step: "email", email, error: friendlyError(error.message) };
    return { step: "code", email };
  }

  if (intent === "verify") {
    const token = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!CODE_PATTERN.test(token)) {
      return { step: "code", email, error: "Enter the code from the email." };
    }
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { step: "code", email, error: friendlyError(error.message) };
    redirect(safeNextPath(String(formData.get("next") ?? "")));
  }

  return previous;
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit")) {
    return "Too many emails sent. Wait a few minutes and try again.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "This email doesn't have an account.";
  }
  if (m.includes("expired") || m.includes("invalid")) {
    return "That code is wrong or has expired. Request a new one.";
  }
  return "Something went wrong. Please try again.";
}
