"use server";

import { authErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { status: "idle" | "saved" | "error"; message?: string };

// Supabase hashes passwords with bcrypt, which only uses the first 72 bytes.
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

export async function changePassword(
  _previous: PasswordState,
  form: FormData,
): Promise<PasswordState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    return { status: "error", message: `Use at least ${MIN_LENGTH} characters.` };
  }
  if (new TextEncoder().encode(password).length > MAX_LENGTH) {
    return { status: "error", message: "That's too long. Use 72 characters or fewer." };
  }
  if (password !== confirm) return { status: "error", message: "The passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: authErrorMessage(error, "change_password") };
  return { status: "saved" };
}
