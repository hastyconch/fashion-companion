"use client";

import { useActionState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type PasswordState } from "./actions";

export function ChangePassword() {
  const [state, action, pending] = useActionState(changePassword, {
    status: "idle",
  } satisfies PasswordState);

  return (
    <details className="group rounded-3xl border bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-sm [&::-webkit-details-marker]:hidden">
        <span>Change password</span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <form action={action} className="flex flex-col gap-4 border-t px-5 py-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
          <p aria-live="polite" className="text-sm">
            {state.status === "saved" && !pending && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Check className="size-4" /> Password changed
              </span>
            )}
            {state.status === "error" && <span className="text-destructive">{state.message}</span>}
          </p>
        </div>
      </form>
    </details>
  );
}
