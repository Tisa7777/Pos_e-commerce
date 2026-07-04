import type { PropsWithChildren, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps extends PropsWithChildren {
  title: string;
  description?: string;
  open?: boolean;
  className?: string;
  size?: ModalSize;
  icon?: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-7xl",
};

export function Modal({
  title,
  description,
  open = false,
  className,
  size = "md",
  icon,
  onClose,
  footer,
  children,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c1712]/55 px-4 py-8 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full animate-scale-in border border-white/70 p-0 shadow-[0_40px_120px_-24px_rgba(12,23,18,0.45)]",
          sizeStyles[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex items-start gap-4 min-w-0">
            {icon ? (
              <div className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
                {icon}
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-[#0c1712] truncate">
                {title}
              </h2>
              {description ? (
                <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
              ) : null}
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-white text-muted shadow-sm transition-all hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
            >
              <PremiumIcon name="close" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="px-6 py-5 sm:px-8 sm:py-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 bg-gradient-to-b from-transparent to-primary/[0.02] px-6 py-4 sm:px-8">
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
