import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({
  className,
  error,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm text-foreground",
        "placeholder:text-muted/50",
        "transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:border-black/[0.12]",
        error
          ? "border-red-300 focus:border-red-400 focus:outline-none focus:ring-4 focus:ring-red-100"
          : "border-black/[0.08] focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/8 focus:shadow-[0_0_20px_-8px_rgba(13,148,136,0.25)]",
        className,
      )}
      {...props}
    />
  );
}
