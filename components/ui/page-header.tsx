import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  action?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between animate-in">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <span className="inline-block h-1 w-4 rounded-full bg-primary/40" />
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-3">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-current sm:text-5xl">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-base leading-7 text-current/70">{description}</p>
          ) : null}
        </div>
      </div>
      {action ?? (actionHref && actionLabel ? <LinkButton href={actionHref}>{actionLabel}</LinkButton> : null)}
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild className="h-11 rounded-2xl bg-[#0c1712] px-6 text-sm font-semibold text-white shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-8px_rgba(12,23,18,0.5)]">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
