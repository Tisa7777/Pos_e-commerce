import type { HTMLAttributes, PropsWithChildren, TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("min-w-full text-left text-sm", className)}
      {...props}
    />
  );
}

export function THead({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) {
  return (
    <thead
      className={cn(
        "border-b border-border/70 bg-gradient-to-b from-slate-50/90 to-slate-100/60 text-muted backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableSectionElement>>) {
  return <tbody className={cn("divide-y divide-border/40", className)} {...props} />;
}

export function TR({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableRowElement>>) {
  return (
    <tr
      className={cn(
        "align-middle transition-colors hover:bg-primary/[0.03]",
        className,
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableCellElement>>) {
  return (
    <th
      className={cn(
        "px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLTableCellElement>>) {
  return (
    <td
      className={cn("px-5 py-4 text-sm text-[#0c1712]", className)}
      {...props}
    />
  );
}
