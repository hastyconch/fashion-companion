"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { step: "email", email: "" };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  if (state.step === "code") {
    return (
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1">
          <h2 className="font-display text-2xl">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in code to{" "}
            <span className="font-medium text-foreground">{state.email}</span>.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            placeholder="123456"
            autoFocus
            required
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "login-error" : undefined}
            className="text-center text-xl tracking-[0.4em]"
          />
        </div>
        <FormError message={state.error} />
        <Button type="submit" name="intent" value="verify" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <Button
            type="submit"
            name="intent"
            value="restart"
            variant="link"
            className="h-auto px-0 text-muted-foreground"
            formNoValidate
          >
            Use a different email
          </Button>
          <Button
            type="submit"
            name="intent"
            value="send"
            variant="link"
            className="h-auto px-0 text-muted-foreground"
            formNoValidate
            disabled={pending}
          >
            Send a new code
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          On a computer you can also tap the link in the email. If you installed
          the app on your phone, type the code here instead: the link opens in
          your browser, not the app.
        </p>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={state.email}
          autoFocus
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <FormError message={state.error} />
      <Button type="submit" name="intent" value="send" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in code"}
      </Button>
      <p className="text-xs text-muted-foreground">
        No password needed. We&apos;ll email you a one-time code.
      </p>
    </form>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p id="login-error" role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
