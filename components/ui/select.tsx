import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-black/[0.08] bg-white px-4 pr-10 text-sm text-foreground",
          "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:border-black/[0.12]",
          "focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:shadow-[0_0_20px_-8px_rgba(13,148,136,0.25)]",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
