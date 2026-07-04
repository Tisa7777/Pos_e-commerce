import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "soft" | "danger" | "success" | "white";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps
  extends PropsWithChildren,
    ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-teal-700 active:bg-teal-800",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:bg-slate-800 active:bg-slate-900",
  ghost:
    "border border-border/80 bg-white text-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:bg-primary/10",
  outline:
    "border border-primary/30 bg-transparent text-primary hover:bg-primary/5 hover:border-primary/50 active:bg-primary/10",
  soft:
    "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:border-primary/30 active:bg-primary/20",
  danger:
    "bg-danger text-white shadow-sm hover:bg-red-600 active:bg-red-700",
  success:
    "bg-success text-white shadow-sm hover:bg-emerald-600 active:bg-emerald-700",
  white:
    "bg-white text-secondary shadow-sm hover:bg-slate-50 active:bg-slate-100",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-7 text-[15px] gap-2.5",
  icon: "h-10 w-10 p-0 justify-center",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  fullWidth = false,
  asChild = false,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-lg font-semibold",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
    "transition-colors duration-150",
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && "w-full",
    className,
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, {
      className: cn(classes, child.props.className),
    });
  }

  return (
    <button
      type="button"
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
}
