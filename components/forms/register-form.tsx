"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { registerAction } from "@/app/actions/auth";
import { FieldError, FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/types/domain";

const initialState: ActionState = {
  ok: false,
  message: "",
};

export function RegisterForm({ idPrefix = "" }: { idPrefix?: string }) {
  const [state, formAction] = useActionState(registerAction, initialState);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fullNameId = `${idPrefix}fullName`;
  const emailId = `${idPrefix}email`;
  const phoneId = `${idPrefix}phone`;
  const passwordId = `${idPrefix}password`;
  const confirmPasswordId = `${idPrefix}confirmPassword`;
  const passwordRequirementsId = `${passwordId}-requirements`;
  const fullNameError = state.fieldErrors?.fullName;
  const emailError = state.fieldErrors?.email;
  const phoneError = state.fieldErrors?.phone;
  const passwordError = state.fieldErrors?.password;
  const confirmPasswordError = state.fieldErrors?.confirmPassword;
  const passwordRules = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Upper and lower case", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "At least one number", met: /[0-9]/.test(password) },
  ];

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor={fullNameId}>
          Full name
        </label>
        <Input
          id={fullNameId}
          name="fullName"
          autoComplete="name"
          icon={<UserRound className="h-4 w-4" />}
          maxLength={80}
          placeholder="Rina Sok"
          error={Boolean(fullNameError?.length)}
          aria-describedby={fullNameError?.length ? `${fullNameId}-error` : undefined}
          aria-invalid={Boolean(fullNameError?.length)}
          required
        />
        <FieldError id={`${fullNameId}-error`} errors={fullNameError} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor={emailId}>
            Email
          </label>
          <Input
            id={emailId}
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
            aria-describedby={emailError?.length ? `${emailId}-error` : undefined}
            aria-invalid={Boolean(emailError?.length)}
            required
          />
          <FieldError id={`${emailId}-error`} errors={emailError} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor={phoneId}>
            Phone
          </label>
          <Input
            id={phoneId}
            name="phone"
            type="tel"
            autoComplete="tel"
            icon={<Phone className="h-4 w-4" />}
            inputMode="tel"
            maxLength={32}
            placeholder="+855 12 345 678"
            error={Boolean(phoneError?.length)}
            aria-describedby={phoneError?.length ? `${phoneId}-error` : undefined}
            aria-invalid={Boolean(phoneError?.length)}
          />
          <FieldError id={`${phoneId}-error`} errors={phoneError} />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor={passwordId}>
          Password
        </label>
        <div className="relative">
          <Input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="pr-11"
            icon={<LockKeyhole className="h-4 w-4" />}
            maxLength={128}
            minLength={8}
            placeholder="8+ chars, upper, lower, number"
            error={Boolean(passwordError?.length)}
            aria-describedby={joinIds(
              passwordRequirementsId,
              passwordError?.length ? `${passwordId}-error` : undefined,
            )}
            aria-invalid={Boolean(passwordError?.length)}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <PasswordToggleButton
            isVisible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
        </div>
        <FieldError id={`${passwordId}-error`} errors={passwordError} />
        <div
          id={passwordRequirementsId}
          className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3"
          aria-live="polite"
        >
          {passwordRules.map((rule) => {
            const RuleIcon = rule.met ? CheckCircle2 : Circle;

            return (
              <div
                key={rule.label}
                className={`inline-flex items-center gap-2 text-xs font-medium ${
                  rule.met ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                <RuleIcon
                  aria-hidden={true}
                  className="h-3.5 w-3.5 shrink-0"
                  strokeWidth={2}
                />
                <span>{rule.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor={confirmPasswordId}>
          Confirm password
        </label>
        <div className="relative">
          <Input
            id={confirmPasswordId}
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            className="pr-11"
            icon={<LockKeyhole className="h-4 w-4" />}
            maxLength={128}
            placeholder="Repeat your password"
            error={Boolean(confirmPasswordError?.length)}
            aria-describedby={
              confirmPasswordError?.length ? `${confirmPasswordId}-error` : undefined
            }
            aria-invalid={Boolean(confirmPasswordError?.length)}
            required
          />
          <PasswordToggleButton
            isVisible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((current) => !current)}
          />
        </div>
        <FieldError id={`${confirmPasswordId}-error`} errors={confirmPasswordError} />
      </div>
      <FormFeedback state={state} />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

function PasswordToggleButton({
  isVisible,
  onToggle,
}: {
  isVisible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      onClick={onToggle}
      aria-label={isVisible ? "Hide password" : "Show password"}
      aria-pressed={isVisible}
    >
      {isVisible ? (
        <EyeOff aria-hidden={true} className="h-4 w-4" />
      ) : (
        <Eye aria-hidden={true} className="h-4 w-4" />
      )}
    </button>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle aria-hidden={true} className="h-4 w-4 animate-spin" />
          Creating account...
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function joinIds(...ids: Array<string | undefined>) {
  const value = ids.filter(Boolean).join(" ");

  return value || undefined;
}
