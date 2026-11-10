"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { step: "password", email: "" };

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
            We sent a sign-in email to{" "}
            <span className="font-medium text-foreground">{state.email}</span>. Tap the link in it{" "}
            <strong className="font-medium text-foreground">in this browser</strong>.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">If the email shows a code, enter it here</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={12}
            placeholder="123456"
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "login-error" : undefined}
            className="text-center text-xl tracking-[0.4em]"
          />
        </div>
        <FormError message={state.error} />
        <Button type="submit" name="intent" value="verify" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in with code"}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <SwitchButton intent="use-password">Use my password</SwitchButton>
          <SwitchButton intent="send" disabled={pending}>
            Send another email
          </SwitchButton>
        </div>
      </form>
    );
  }

  if (state.step === "email") {
    return (
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />
        <EmailField defaultValue={state.email} error={state.error} />
        <FormError message={state.error} />
        <Button type="submit" name="intent" value="send" size="lg" disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Open the link in this browser. If you use the app from your home screen, sign in with
          your password instead: email links open in your browser, not the app.
        </p>
        <SwitchButton intent="use-password" className="self-start">
          Sign in with password
        </SwitchButton>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <EmailField defaultValue={state.email} error={state.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <FormError message={state.error} />
      <Button type="submit" name="intent" value="password" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <SwitchButton intent="use-email" className="self-start">
        Email me a sign-in link instead
      </SwitchButton>
    </form>
  );
}

function EmailField({ defaultValue, error }: { defaultValue: string; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={defaultValue}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "login-error" : undefined}
      />
    </div>
  );
}

/** A link-styled submit button that switches steps without validating the form. */
function SwitchButton({
  intent,
  className,
  disabled,
  children,
}: {
  intent: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant="link"
      formNoValidate
      disabled={disabled}
      className={`h-auto px-0 text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </Button>
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
