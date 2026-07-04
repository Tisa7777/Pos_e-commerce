"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { FieldError, FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/types/domain";

const initialState: ActionState = {
  ok: false,
  message: "",
};

export function LoginForm({
  redirectTo,
  submitLabel = "Sign in",
}: {
  redirectTo?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo ?? ""} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          icon={<Mail className="h-4 w-4" />}
          inputMode="email"
          placeholder="you@example.com"
          spellCheck={false}
          error={Boolean(emailError?.length)}
          aria-describedby={emailError?.length ? "email-error" : undefined}
          aria-invalid={Boolean(emailError?.length)}
          required
        />
        <FieldError id="email-error" errors={emailError} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-11"
            icon={<LockKeyhole className="h-4 w-4" />}
            placeholder="Your password"
            error={Boolean(passwordError?.length)}
            aria-describedby={passwordError?.length ? "password-error" : undefined}
            aria-invalid={Boolean(passwordError?.length)}
            required
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff aria-hidden={true} className="h-4 w-4" />
            ) : (
              <Eye aria-hidden={true} className="h-4 w-4" />
            )}
          </button>
        </div>
        <FieldError id="password-error" errors={passwordError} />
      </div>
      <FormFeedback state={state} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle aria-hidden={true} className="h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
