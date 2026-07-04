"use client";

import { endOfDay, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { Select } from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import {
  formatOrderDateLine,
  getPaymentMethodMeta,
  getReceiptDisplayTotals,
  ReceiptCard,
} from "@/components/pos/receipt-card";
import { exportReceiptCsv } from "@/lib/export/csv";
import { printReceiptFromData } from "@/lib/print-receipt";
import type { PrintReceiptPayload } from "@/lib/print-receipt";
import { formatCurrency } from "@/lib/utils";
import type { ReceiptData } from "@/types/domain";

type DateFilter = "today" | "week" | "month" | "custom";
type PaymentFilter = "all" | "cash" | "card" | "qr";
type ChannelFilter = "all" | "pos" | "ecommerce";

const ALL_CASHIERS_FILTER = "__all_cashiers__";

function getReceiptChannel(receipt: ReceiptData): "pos" | "ecommerce" {
  return receipt.order.channel === "ecommerce" ? "ecommerce" : "pos";
}

function getReceiptSourceMeta(receipt: ReceiptData) {
  return getReceiptChannel(receipt) === "ecommerce"
    ? { label: "Online order", className: "border-sky-300/30 bg-sky-300/10 text-sky-200" }
    : { label: "POS register", className: "border-teal-300/30 bg-teal-300/10 text-teal-200" };
}

function getReceiptCashierName(receipt: ReceiptData) {
  if (getReceiptChannel(receipt) === "ecommerce") {
    return receipt.cashierName?.trim() || "Online";
  }
  return receipt.cashierName?.trim() || "Cashier";
}

function getReceiptSearchText(receipt: ReceiptData) {
  return `${receipt.order.orderNumber} ${receipt.order.customerName ?? "Walk-in Customer"} ${getReceiptCashierName(receipt)}`.toLowerCase();
}

function formatHistoryDate(value: string) {
  return format(new Date(value), "MMM d, yyyy");
}

function formatHistoryTime(value: string) {
  return format(new Date(value), "h:mm a");
}

function isReceiptInRange(receipt: ReceiptData, dateFilter: DateFilter, customFrom: string, customTo: string) {
  const createdAt = new Date(receipt.order.createdAt);
  const now = new Date();

  if (dateFilter === "today") {
    return createdAt >= startOfDay(now) && createdAt <= endOfDay(now);
  }

  if (dateFilter === "week") {
    return createdAt >= startOfWeek(now, { weekStartsOn: 1 }) && createdAt <= endOfDay(now);
  }

  if (dateFilter === "month") {
    return createdAt >= startOfMonth(now) && createdAt <= endOfDay(now);
  }

  const fromDate = customFrom ? startOfDay(new Date(customFrom)) : null;
  const toDate = customTo ? endOfDay(new Date(customTo)) : null;

  if (fromDate && createdAt < fromDate) {
    return false;
  }

  if (toDate && createdAt > toDate) {
    return false;
  }

  return true;
}

export function PosHistoryConsole({
  receipts,
  khrRate = 0,
}: {
  receipts: ReceiptData[];
  khrRate?: number;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [cashierFilter, setCashierFilter] = useState(ALL_CASHIERS_FILTER);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const cashierOptions = Array.from(
    new Set(receipts.map((receipt) => getReceiptCashierName(receipt))),
  ).sort((left, right) => left.localeCompare(right));

  const filteredReceipts = receipts.filter((receipt) => {
    if (!isReceiptInRange(receipt, dateFilter, customFrom, customTo)) {
      return false;
    }

    if (channelFilter !== "all" && getReceiptChannel(receipt) !== channelFilter) {
      return false;
    }

    if (paymentFilter !== "all" && receipt.paymentMethod !== paymentFilter) {
      return false;
    }

    if (
      cashierFilter !== ALL_CASHIERS_FILTER &&
      getReceiptCashierName(receipt) !== cashierFilter
    ) {
      return false;
    }

    if (deferredSearch.trim()) {
      return getReceiptSearchText(receipt).includes(deferredSearch.trim().toLowerCase());
    }

    return true;
  });

  const selectedReceipt =
    receipts.find((receipt) => receipt.order.id === selectedReceiptId) ?? null;

  const summaryRevenue = filteredReceipts.reduce(
    (sum, receipt) => sum + getReceiptDisplayTotals(receipt).total,
    0,
  );
  const summaryCashiers = new Set(
    filteredReceipts.map((receipt) => getReceiptCashierName(receipt)),
  ).size;

  return (
    <>
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,22,37,0.98)_0%,rgba(7,17,31,0.96)_100%)] shadow-[0_24px_80px_-42px_rgba(0,0,0,0.85)]">
          <div className="border-b border-white/8 px-6 py-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-300">
                    POS history
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                    Completed sales & online orders
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                    Search register sales and online orders together, filter by source, payment, or
                    date, and open the full receipt without leaving the register flow.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-[1.35rem] border border-teal-300/14 bg-teal-300/8 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Filtered revenue
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {formatCurrency(summaryRevenue)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      exportReceiptCsv(
                        filteredReceipts.map((receipt) => {
                          const totals = getReceiptDisplayTotals(receipt);
                          return {
                            orderNumber: receipt.order.orderNumber,
                            customerName: receipt.order.customerName ?? null,
                            cashierName: receipt.cashierName ?? "Cashier",
                            paymentMethod: receipt.paymentMethod,
                            total: totals.total,
                            createdAt: receipt.order.createdAt,
                            items: receipt.order.items.map((item) => ({
                              productName: item.productName,
                              quantity: item.quantity,
                              unitPrice: item.unitPrice,
                              lineTotal: item.lineTotal,
                            })),
                          };
                        }),
                      );
                    }}
                    className="flex h-12 items-center gap-2 rounded-[1.35rem] border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-white transition-all hover:border-teal-300/30 hover:bg-white/[0.08]"
                  >
                    <PremiumIcon name="csv" className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[170px_150px_150px_170px_minmax(0,1fr)]">
                <Select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                  className="border-white/10 bg-white/[0.05] text-white focus:border-teal-300/40 focus:ring-teal-300/10"
                >
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                  <option value="custom">Custom range</option>
                </Select>

                <Select
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value as ChannelFilter)}
                  className="border-white/10 bg-white/[0.05] text-white focus:border-teal-300/40 focus:ring-teal-300/10"
                >
                  <option value="all">All sources</option>
                  <option value="pos">POS register</option>
                  <option value="ecommerce">Online orders</option>
                </Select>

                <Select
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
                  className="border-white/10 bg-white/[0.05] text-white focus:border-teal-300/40 focus:ring-teal-300/10"
                >
                  <option value="all">All payments</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="qr">QR</option>
                </Select>

                <Select
                  value={cashierFilter}
                  onChange={(event) => setCashierFilter(event.target.value)}
                  className="border-white/10 bg-white/[0.05] text-white focus:border-teal-300/40 focus:ring-teal-300/10"
                >
                  <option value={ALL_CASHIERS_FILTER}>All cashiers</option>
                  {cashierOptions.map((cashier) => (
                    <option key={cashier} value={cashier}>
                      {cashier}
                    </option>
                  ))}
                </Select>

                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by order ID, customer, or cashier..."
                  className="h-11 border-white/10 bg-white/[0.05] text-white placeholder:text-slate-500 focus:border-teal-300/40 focus:ring-teal-300/10"
                />
              </div>

              {dateFilter === "custom" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="h-11 border-white/10 bg-white/[0.05] text-white focus:border-teal-300/40 focus:ring-teal-300/10"
                  />
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="h-11 border-white/10 bg-white/[0.05] text-white focus:border-teal-300/40 focus:ring-teal-300/10"
                  />
                </div>
              ) : null}

              <p className="text-sm text-slate-400">
                Showing {filteredReceipts.length} orders · {formatCurrency(summaryRevenue)} revenue ·{" "}
                {summaryCashiers} cashiers
              </p>
            </div>
          </div>

          <div className="space-y-4 px-6 py-6">
            {filteredReceipts.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.04] px-6 py-12 text-center">
                <p className="text-lg font-semibold text-white">No receipts match this filter</p>
                <p className="mt-2 text-sm text-slate-400">
                  Try a wider date range or search with a different order number.
                </p>
              </div>
            ) : (
              filteredReceipts.map((receipt) => {
                const payment = getPaymentMethodMeta(receipt.paymentMethod);
                const total = getReceiptDisplayTotals(receipt).total;
                const source = getReceiptSourceMeta(receipt);

                return (
                  <button
                    key={receipt.order.id}
                    type="button"
                    onClick={() => setSelectedReceiptId(receipt.order.id)}
                    className="group flex w-full flex-col gap-4 rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,29,47,0.92)_0%,rgba(9,19,33,0.96)_100%)] p-5 text-left shadow-[0_18px_42px_-32px_rgba(15,23,42,0.7)] hover:border-teal-300/30 hover:bg-[linear-gradient(180deg,rgba(21,36,57,0.98)_0%,rgba(12,24,40,0.98)_100%)]"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-white">
                            {receipt.order.orderNumber}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${source.className}`}
                          >
                            {source.label}
                          </span>
                          <OrderStatusBadge status={receipt.order.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          {receipt.order.customerName ?? "Walk-in Customer"} ·{" "}
                          {getReceiptCashierName(receipt)} ·{" "}
                          {formatHistoryDate(receipt.order.createdAt)} ·{" "}
                          {formatHistoryTime(receipt.order.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 md:min-w-[260px] md:justify-end">
                        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300">
                          <PremiumIcon name={payment.iconName} className="h-4 w-4" />
                          {payment.label}
                        </p>
                        <p className="font-mono text-xl font-semibold text-white">
                          {formatCurrency(total)}
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 group-hover:border-teal-300/30 group-hover:text-white">
                          View Receipt →
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selectedReceipt ? (
        <ReceiptDrawer receipt={selectedReceipt} khrRate={khrRate} onClose={() => setSelectedReceiptId(null)} />
      ) : null}
    </>
  );
}

function receiptToPayload(receipt: ReceiptData, khrRate: number): PrintReceiptPayload {
  const totals = getReceiptDisplayTotals(receipt);
  return {
    orderNumber: receipt.order.orderNumber,
    createdAt: receipt.order.createdAt,
    customerName: receipt.order.customerName ?? "Walk-in Customer",
    cashierName: receipt.cashierName ?? "Cashier",
    paymentMethod: receipt.paymentMethod,
    items: receipt.order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: totals.subtotal,
    tax: totals.tax,
    taxRate: totals.taxRate,
    discount: totals.discount,
    total: totals.total,
    cashReceived: receipt.cashReceived,
    changeGiven: receipt.changeGiven,
    khrRate: khrRate > 0 ? khrRate : undefined,
  };
}

function ReceiptDrawer({
  onClose,
  receipt,
  khrRate,
}: {
  onClose: () => void;
  receipt: ReceiptData;
  khrRate: number;
}) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-full animate-[pos-drawer-slide-in_220ms_ease-out] flex-col border-l border-white/10 bg-[linear-gradient(180deg,rgba(8,22,37,0.99)_0%,rgba(5,14,25,0.99)_100%)] shadow-[-30px_0_80px_-38px_rgba(15,23,42,0.92)] sm:max-w-[420px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-300">
                Receipt
              </p>
              <h3 className="mt-2 font-mono text-lg font-semibold text-white">
                {receipt.order.orderNumber}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {formatOrderDateLine(receipt.order.createdAt)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]"
            >
              <PremiumIcon name="close" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <ReceiptCard receipt={receipt} />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const totals = getReceiptDisplayTotals(receipt);
              exportReceiptCsv([{
                orderNumber: receipt.order.orderNumber,
                customerName: receipt.order.customerName ?? null,
                cashierName: receipt.cashierName ?? "Cashier",
                paymentMethod: receipt.paymentMethod,
                total: totals.total,
                createdAt: receipt.order.createdAt,
                items: receipt.order.items.map((item) => ({
                  productName: item.productName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                })),
              }]);
            }}
            className="border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]"
          >
            <PremiumIcon name="csv" className="h-4 w-4" />
            Download CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => printReceiptFromData(receiptToPayload(receipt, khrRate))}
            className="border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]"
          >
            <PremiumIcon name="print" className="h-4 w-4" />
            Print Receipt
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="bg-teal-700 text-white hover:bg-teal-600"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
