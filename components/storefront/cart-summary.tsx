import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function CartSummary({
  subtotal,
  discountAmount,
  total,
  footer,
}: {
  subtotal: number;
  discountAmount: number;
  total: number;
  footer?: ReactNode;
}) {
  const hasDiscount = discountAmount > 0;

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-b from-[#f0fdf8] to-white shadow-[0_20px_40px_-12px_rgba(13,148,136,0.15)] ring-1 ring-primary/10">
      <CardHeader className="border-b border-primary/5 bg-white/60 backdrop-blur-sm">
        <CardTitle className="font-serif text-xl">Order summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 bg-white/60 pt-5 backdrop-blur-sm">
        <Row label="Subtotal" value={formatCurrency(subtotal)} />
        <Row
          label="Discount"
          value={hasDiscount ? `-${formatCurrency(discountAmount)}` : formatCurrency(0)}
          highlight={hasDiscount ? "success" : undefined}
        />
        <Row label="Shipping" value="Calculated at checkout" muted />
        <div className="h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
        <div className="flex items-end justify-between gap-4 pt-1">
          <div>
            <p className="font-serif text-base font-semibold text-[#0c1712]">Total</p>
            <p className="text-xs text-muted">Including taxes</p>
          </div>
          <span className="font-mono text-2xl font-semibold tracking-tight text-primary">
            {formatCurrency(total)}
          </span>
        </div>
        {footer ? <div className="pt-2">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  muted = false,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: "success";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={
          highlight === "success"
            ? "text-sm font-semibold text-emerald-600"
            : muted
              ? "text-xs text-muted/80"
              : "text-sm font-medium text-[#0c1712]"
        }
      >
        {value}
      </span>
    </div>
  );
}
