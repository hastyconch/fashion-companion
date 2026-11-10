"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authErrorMessage } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * password: email + password (the default; works inside the installed app)
 * email:    ask for a sign-in email
 * code:     email sent; follow the link or type the code if the email has one
 */
export type LoginState = {
  step: "password" | "email" | "code";
  email: string;
  error?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6,10}$/;

/** One action drives every step, so the form stays a thin useActionState wrapper. */
export async function loginAction(previous: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (intent === "use-password") return { step: "password", email };
  if (intent === "use-email") return { step: "email", email };

  const step = intent === "verify" ? "code" : intent === "send" ? "email" : "password";
  if (!EMAIL_PATTERN.test(email)) {
    return { step, email, error: "Enter a valid email address." };
  }

  const supabase = await createClient();

  if (intent === "password") {
    const password = String(formData.get("password") ?? "");
    if (!password) return { step: "password", email, error: "Enter your password." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { step: "password", email, error: authErrorMessage(error, "password") };
    redirect(next);
  }

  if (intent === "send") {
    const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Sign-in only: never create an account from this form.
        shouldCreateUser: false,
        ...(origin && {
          emailRedirectTo: `${origin}/auth/callback?${new URLSearchParams({ next })}`,
        }),
      },
    });
    if (error) return { step: "email", email, error: authErrorMessage(error, "email") };
    return { step: "code", email };
  }

  if (intent === "verify") {
    const token = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!CODE_PATTERN.test(token)) {
      return { step: "code", email, error: "Enter the code from the email." };
    }
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { step: "code", email, error: authErrorMessage(error, "code") };
    redirect(next);
  }

  return previous;
}
