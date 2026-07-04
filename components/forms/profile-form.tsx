"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Mail, Phone, UserRound } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";
import { FieldError, FormFeedback } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/types/domain";

const initialState: ActionState = {
  ok: false,
  message: "",
};

export function ProfileForm({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string;
  phone?: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  const fullNameError = state.fieldErrors?.fullName;
  const phoneError = state.fieldErrors?.phone;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="profile-fullName">
          Full name
        </label>
        <Input
          id="profile-fullName"
          name="fullName"
          autoComplete="name"
          icon={<UserRound className="h-4 w-4" />}
          maxLength={80}
          defaultValue={fullName}
          placeholder="Your name"
          error={Boolean(fullNameError?.length)}
          aria-describedby={fullNameError?.length ? "profile-fullName-error" : undefined}
          aria-invalid={Boolean(fullNameError?.length)}
          required
        />
        <FieldError id="profile-fullName-error" errors={fullNameError} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="profile-email">
          Email
        </label>
        <Input
          id="profile-email"
          name="email"
          type="email"
          icon={<Mail className="h-4 w-4" />}
          defaultValue={email}
          disabled
          readOnly
        />
        <p className="text-xs text-slate-400">Email cannot be changed here.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="profile-phone">
          Phone
        </label>
        <Input
          id="profile-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          icon={<Phone className="h-4 w-4" />}
          maxLength={32}
          defaultValue={phone ?? ""}
          placeholder="+855 12 345 678"
          error={Boolean(phoneError?.length)}
          aria-describedby={phoneError?.length ? "profile-phone-error" : undefined}
          aria-invalid={Boolean(phoneError?.length)}
        />
        <FieldError id="profile-phone-error" errors={phoneError} />
      </div>

      <FormFeedback state={state} />
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle aria-hidden={true} className="h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
