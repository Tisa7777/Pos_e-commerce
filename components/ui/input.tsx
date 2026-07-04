import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, icon, iconPosition = "left", error, ...props }, ref) {
    const hasIcon = !!icon;
    
    return (
      <div className="relative">
        {hasIcon && iconPosition === "left" && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "h-11 w-full rounded-xl border bg-white px-4 text-sm text-foreground",
            "placeholder:text-muted/50",
            "transition-colors duration-150",
            hasIcon && iconPosition === "left" && "pl-11",
            hasIcon && iconPosition === "right" && "pr-11",
            error 
              ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100" 
              : "border-slate-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/15",
            "hover:border-black/[0.12]",
            className,
          )}
          {...props}
        />
        {hasIcon && iconPosition === "right" && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none">
            {icon}
          </div>
        )}
      </div>
    );
  },
);
