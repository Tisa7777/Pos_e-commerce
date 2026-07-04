import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumIcon } from "@/components/ui/premium-icon";
import type { PremiumIconName } from "@/lib/premium-icons";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryAction?: ReactNode;
  iconName?: PremiumIconName;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  secondaryAction,
  iconName = "package",
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-dashed border-primary/15 bg-gradient-to-br from-white via-white to-primary/[0.03]",
        className,
      )}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-[60px]" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-amber-400/10 blur-[50px]" />

      <CardContent className="relative flex flex-col items-center gap-5 py-16 text-center">
        <div className="relative">
          <span className="absolute inset-0 animate-[pulse-ring_2.6s_ease-out_infinite] rounded-2xl bg-primary/15" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
            <PremiumIcon name={iconName} className="h-7 w-7" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="font-serif text-2xl font-semibold tracking-tight text-[#0c1712]">
            {title}
          </h3>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
        {(actionHref && actionLabel) || secondaryAction ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {actionHref && actionLabel ? (
              <Button asChild>
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            ) : null}
            {secondaryAction}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
