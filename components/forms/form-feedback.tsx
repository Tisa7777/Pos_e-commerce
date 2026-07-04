import { CircleAlert, CircleCheck } from "lucide-react";
import type { ActionState } from "@/types/domain";

export function FormFeedback({ state }: { state: ActionState }) {
  if (!state.message) {
    return null;
  }

  const Icon = state.ok ? CircleCheck : CircleAlert;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2 ${
        state.ok
          ? "border-emerald-200/50 bg-emerald-50/80 text-emerald-700"
          : "border-rose-200/50 bg-rose-50/80 text-rose-700"
      }`}
    >
      <Icon
        aria-hidden={true}
        className={`mt-0.5 h-4 w-4 shrink-0 ${state.ok ? "text-emerald-500" : "text-rose-500"}`}
        strokeWidth={2}
      />
      <p className="leading-5">{state.message}</p>
    </div>
  );
}

export function FieldError({
  errors,
  id,
}: {
  errors?: string[];
  id?: string;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p id={id} className="text-xs font-medium text-rose-600">
      {errors[0]}
    </p>
  );
}
