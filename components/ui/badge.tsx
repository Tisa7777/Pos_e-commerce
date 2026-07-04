import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "info" | "accent" | "soft" | "outline";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  variant?: BadgeVariant;
  /** @deprecated Use variant instead */
  tone?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200/80",
  primary: "bg-gradient-to-r from-primary/15 to-teal-500/10 text-primary border-primary/20",
  success: "bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 border-emerald-200/80",
  warning: "bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 border-amber-200/80",
  danger: "bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 border-red-200/80",
  info: "bg-gradient-to-r from-blue-50 to-sky-100/50 text-blue-700 border-blue-200/80",
  accent: "bg-gradient-to-r from-amber-100/80 to-orange-100/50 text-amber-800 border-amber-300/60",
  soft: "bg-primary/8 text-primary/90 border-primary/15",
  outline: "bg-transparent text-foreground border-border/60",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
  lg: "px-3 py-1.5 text-sm gap-2",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-slate-400",
  primary: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  accent: "bg-amber-500",
  soft: "bg-primary/60",
  outline: "bg-muted",
};

export function Badge({
  children,
  variant,
  tone,
  size = "md",
  dot = false,
  className,
}: PropsWithChildren<BadgeProps>) {
  // Handle backward compatibility with tone prop
  const effectiveVariant: BadgeVariant = variant ?? (tone as BadgeVariant) ?? "default";
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium backdrop-blur-sm",
        variantStyles[effectiveVariant],
        sizeStyles[size],
        className,
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[effectiveVariant])} />
      )}
      {children}
    </span>
  );
}
