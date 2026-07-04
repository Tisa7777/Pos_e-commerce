"use client";

import { PremiumIcon } from "@/components/ui/premium-icon";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info" | "warning";

const toneStyles: Record<
  ToastTone,
  {
    container: string;
    iconWrap: string;
    iconName: "check" | "alert" | "bell";
  }
> = {
  success: {
    container: "border-emerald-200/70 bg-white/95 text-emerald-800",
    iconWrap: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
    iconName: "check",
  },
  error: {
    container: "border-rose-200/70 bg-white/95 text-rose-800",
    iconWrap: "bg-gradient-to-br from-rose-500 to-red-600 text-white",
    iconName: "alert",
  },
  info: {
    container: "border-sky-200/70 bg-white/95 text-sky-800",
    iconWrap: "bg-gradient-to-br from-sky-500 to-blue-600 text-white",
    iconName: "bell",
  },
  warning: {
    container: "border-amber-200/70 bg-white/95 text-amber-900",
    iconWrap: "bg-gradient-to-br from-amber-500 to-orange-500 text-white",
    iconName: "alert",
  },
};

export function FloatingToast({
  message,
  tone = "success",
}: {
  message: string;
  tone?: ToastTone;
}) {
  if (!message) {
    return null;
  }

  const styles = toneStyles[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed right-6 top-[5.4rem] z-40 flex items-center gap-3 rounded-[1.4rem] border px-4 py-3 text-sm font-semibold backdrop-blur-xl",
        "shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35),0_0_0_1px_rgba(255,255,255,0.5)_inset]",
        "animate-[pos-toast-enter_280ms_cubic-bezier(0.22,1,0.36,1)]",
        styles.container,
      )}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm",
          styles.iconWrap,
        )}
      >
        <PremiumIcon name={styles.iconName} className="h-4 w-4" />
      </span>
      <span className="pr-1">{message}</span>
    </div>
  );
}
