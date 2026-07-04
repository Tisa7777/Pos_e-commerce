"use client";

import { format } from "date-fns";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { getPaymentIconName, getProductIconName } from "@/lib/premium-icons";
import { cn, formatCurrency } from "@/lib/utils";
import type { PaymentMethod, ReceiptData } from "@/types/domain";

export function getPaymentMethodMeta(method: PaymentMethod) {
  switch (method) {
    case "cash":
    case "cash_on_delivery":
      return { iconName: "cash" as const, label: "Cash" };
    case "card":
    case "bank_transfer":
      return { iconName: "card" as const, label: "Card" };
    case "qr":
      return { iconName: "qr" as const, label: "QR" };
    default:
      return { iconName: getPaymentIconName(method), label: "Payment" };
  }
}

export function getReceiptDisplayTotals(receipt: ReceiptData) {
  const subtotal = receipt.displaySubtotal ?? receipt.order.subtotalAmount;
  const tax = receipt.displayTax ?? receipt.order.taxAmount;
  const discount = receipt.displayDiscount ?? receipt.order.discountAmount;
  const total = receipt.displayTotal ?? receipt.order.totalAmount;
  const taxRate =
    receipt.taxRate ??
    (subtotal > 0 && tax > 0 ? Math.min(Math.max(tax / subtotal, 0), 1) : 0);

  return {
    subtotal,
    tax,
    discount,
    total,
    taxRate,
  };
}

export function formatOrderDateLine(value: string) {
  return format(new Date(value), "MMM d, yyyy · h:mm a");
}

export function formatReceiptOrderNumber(orderNumber: string) {
  const segments = orderNumber.split("-");
  return segments.at(-1) ?? orderNumber;
}

export function ReceiptCard({
  className,
  receipt,
}: {
  className?: string;
  receipt: ReceiptData;
}) {
  const paymentMeta = getPaymentMethodMeta(receipt.paymentMethod);
  const { subtotal, tax, discount, total, taxRate } = getReceiptDisplayTotals(receipt);
  const customerName = receipt.order.customerName ?? "Walk-in Customer";
  const cashierName = receipt.cashierName ?? "Cashier";
  const cashReceived =
    receipt.cashReceived ?? (receipt.paymentMethod === "cash" ? total : null);
  const changeGiven =
    receipt.changeGiven ??
    (receipt.paymentMethod === "cash" && cashReceived !== null
      ? Math.max(cashReceived - total, 0)
      : null);

  return (
    <div
      className={cn(
        "receipt-card rounded-[1.8rem] bg-white p-6 text-slate-950 shadow-[0_30px_70px_-44px_rgba(15,23,42,0.62)]",
        className,
      )}
    >
      <div className="space-y-1 text-center">
        <p className="font-mono text-sm font-semibold tracking-[0.28em] text-slate-900">
          TISA POS
        </p>
        <p className="text-sm text-slate-600">Counter Register</p>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">
          {formatOrderDateLine(receipt.order.createdAt)}
        </p>
      </div>

      <div className="mt-5 border-t border-b border-dashed border-slate-300 py-4 text-sm">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium text-slate-500">CUSTOMER:</span>
            <span className="text-right text-slate-900">{customerName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium text-slate-500">CASHIER:</span>
            <span className="text-right text-slate-900">{cashierName}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium text-slate-500">PAYMENT:</span>
            <span className="inline-flex items-center justify-end gap-1.5 text-right text-slate-900">
              <PremiumIcon name={paymentMeta.iconName} className="h-4 w-4" />
              {paymentMeta.label}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-slate-500">
          Items ordered
        </p>
        <div className="mt-4 space-y-4">
          {receipt.order.items.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                <PremiumIcon name={getProductIconName(item.productName)} className="h-4 w-4" />
                {item.productName}
              </p>
              <div className="flex items-center justify-between gap-4 pl-6 text-sm text-slate-500">
                <span>
                  x{item.quantity} · {formatCurrency(item.unitPrice)} ea
                </span>
                <span className="font-mono font-semibold text-slate-950">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-dashed border-slate-300 pt-4 text-sm">
        <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
        <SummaryRow
          label={`Tax (${Math.round(taxRate * 100)}%)`}
          value={formatCurrency(tax)}
          className="mt-2"
        />
        {discount > 0 ? (
          <SummaryRow
            label="Discount"
            value={`-${formatCurrency(discount)}`}
            className="mt-2"
            valueClassName="text-emerald-700"
          />
        ) : null}
        <div className="mt-4 border-t border-dashed border-slate-300 pt-4">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-lg font-semibold tracking-[0.16em] text-slate-900">
              TOTAL
            </span>
            <span className="font-mono text-2xl font-semibold text-slate-950">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {receipt.paymentMethod === "cash" ? (
          <div className="mt-4 space-y-2">
            <SummaryRow
              label="Cash received"
              value={formatCurrency(cashReceived ?? total)}
            />
            <SummaryRow
              label="Change given"
              value={formatCurrency(changeGiven ?? 0)}
            />
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-500">Payment</span>
            <span className="font-medium text-slate-900">
              Paid by {paymentMeta.label}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-dashed border-slate-300 pt-4 text-center text-sm text-slate-600">
        <p>Thank you for your purchase!</p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
          Order #{formatReceiptOrderNumber(receipt.order.orderNumber)}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({
  className,
  label,
  value,
  valueClassName,
}: {
  className?: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-mono text-slate-950", valueClassName)}>{value}</span>
    </div>
  );
}
