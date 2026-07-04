"use client";

import { format } from "date-fns";
import { useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { parsePosReceiptMetadata } from "@/lib/pos/receipt-metadata";
import { getPaymentIconName, type PremiumIconName } from "@/lib/premium-icons";
import { printReceiptFromData, type PrintReceiptPayload } from "@/lib/print-receipt";
import { formatCurrency } from "@/lib/utils";
import type { OrderDetail } from "@/types/domain";

type SourceFilter = "all" | "pos" | "online";
type StatusFilter = "all" | "processing" | "completed";

function formatCambodiaTime(value: string) {
  try {
    return new Date(value).toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return format(new Date(value), "MMM d, yyyy h:mm a");
  }
}

function getSourceBadge(order: OrderDetail) {
  const channel = order.channel;
  if (channel === "pos") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
        <PremiumIcon name="pos" className="h-3.5 w-3.5" />
        POS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <PremiumIcon name="online" className="h-3.5 w-3.5" />
      Online
    </span>
  );
}

function getPaymentText(method: string | null | undefined) {
  switch (method) {
    case "cash": return "Cash";
    case "card": return "Card";
    case "qr": return "QR";
    default: return method ?? "—";
  }
}

function PaymentLabel({ method }: { method: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <PremiumIcon name={getPaymentIconName(method)} className="h-4 w-4 text-slate-500" />
      {getPaymentText(method)}
    </span>
  );
}

interface CashierOrderStats {
  key: string;
  cashierName: string;
  orders: number;
  revenue: number;
  lastSaleAt: string | null;
}

function getOrderCashierName(order: OrderDetail) {
  return order.cashierName?.trim() || "Unassigned Cashier";
}

function getCashierGroupKey(cashierName: string) {
  return `cashier:${cashierName.toLowerCase().replace(/\s+/g, " ")}`;
}

function buildCashierOrderStats(orders: OrderDetail[]) {
  const statsByCashier = new Map<string, CashierOrderStats>();

  for (const order of orders) {
    if (order.channel !== "pos") {
      continue;
    }

    const cashierName = getOrderCashierName(order);
    const key = getCashierGroupKey(cashierName);
    const stats = statsByCashier.get(key) ?? {
      key,
      cashierName,
      orders: 0,
      revenue: 0,
      lastSaleAt: null,
    };

    stats.orders += 1;
    stats.revenue += order.totalAmount;
    stats.lastSaleAt =
      !stats.lastSaleAt || order.createdAt > stats.lastSaleAt ? order.createdAt : stats.lastSaleAt;
    statsByCashier.set(key, stats);
  }

  return Array.from(statsByCashier.values()).sort(
    (left, right) => right.orders - left.orders || right.revenue - left.revenue,
  );
}

function getPrintableOrderNotes(order: OrderDetail) {
  if (order.channel !== "pos") {
    return order.notes ?? null;
  }

  return parsePosReceiptMetadata(order.notes).noteText;
}

function orderToPrintPayload(order: OrderDetail): PrintReceiptPayload {
  const customerName = order.guestName || order.customerName || "Walk-in Customer";
  const cashierName =
    order.channel === "pos"
      ? order.cashierName || "Cashier"
      : "Online (self-service)";
  const taxRate =
    order.subtotalAmount > 0
      ? Math.max(order.taxAmount / order.subtotalAmount, 0)
      : 0;

  return {
    storeName: "TISA POS",
    storeSubtitle: order.channel === "pos" ? "Counter Register" : "Online Order",
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    customerName,
    cashierName,
    paymentMethod: order.paymentMethodLabel ?? "payment",
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotalAmount,
    tax: order.taxAmount,
    taxRate,
    discount: order.discountAmount,
    shipping: order.channel === "ecommerce" ? order.shippingAmount : null,
    total: order.totalAmount,
    notes: getPrintableOrderNotes(order),
  };
}

export function AdminOrdersConsole({ orders }: { orders: OrderDetail[] }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filtered = orders.filter((order) => {
    if (sourceFilter === "pos" && order.channel !== "pos") return false;
    if (sourceFilter === "online" && order.channel === "pos") return false;
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (deferredSearch.trim()) {
      const text = [
        order.orderNumber,
        order.customerName,
        order.guestName,
        order.cashierName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!text.includes(deferredSearch.trim().toLowerCase())) return false;
    }
    return true;
  });

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  const totalRevenue = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
  const posCount = filtered.filter((o) => o.channel === "pos").length;
  const onlineCount = filtered.filter((o) => o.channel !== "pos").length;
  const cashierSales = buildCashierOrderStats(filtered);
  const topCashier = cashierSales[0];

  const filterTabs: {
    key: SourceFilter | StatusFilter;
    label: string;
    iconName?: PremiumIconName;
    active: boolean;
    onClick: () => void;
  }[] = [
    { key: "all", label: "All", active: sourceFilter === "all" && statusFilter === "all", onClick: () => { setSourceFilter("all"); setStatusFilter("all"); } },
    { key: "pos", label: "POS", iconName: "pos", active: sourceFilter === "pos", onClick: () => { setSourceFilter("pos"); setStatusFilter("all"); } },
    { key: "online", label: "Online", iconName: "online", active: sourceFilter === "online", onClick: () => { setSourceFilter("online"); setStatusFilter("all"); } },
    { key: "processing", label: "Processing", active: statusFilter === "processing", onClick: () => { setSourceFilter("all"); setStatusFilter("processing"); } },
    { key: "completed", label: "Completed", active: statusFilter === "completed", onClick: () => { setSourceFilter("all"); setStatusFilter("completed"); } },
  ];

  return (
    <>
      {/* Summary bar */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Total Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">POS Sales</p>
          <p className="mt-2 text-2xl font-semibold text-teal-700">{posCount}</p>
        </div>
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Online Orders</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{onlineCount}</p>
        </div>
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Top Cashier</p>
          <p className="mt-2 truncate text-2xl font-semibold text-slate-950">
            {topCashier?.cashierName ?? "No POS sales"}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {topCashier ? `${topCashier.orders} ${topCashier.orders === 1 ? "sale" : "sales"}` : "0 sales"}
          </p>
        </div>
      </div>

      {cashierSales.length > 0 ? (
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Cashier sales
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Who sold to customers
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              {cashierSales.length} {cashierSales.length === 1 ? "cashier" : "cashiers"}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cashierSales.map((cashier) => (
              <div
                key={cashier.key}
                className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">
                      {cashier.cashierName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last sale {cashier.lastSaleAt ? formatCambodiaTime(cashier.lastSaleAt) : "not available"}
                    </p>
                  </div>
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                    {cashier.orders} {cashier.orders === 1 ? "sale" : "sales"}
                  </span>
                </div>
                <p className="mt-3 font-mono text-sm font-semibold text-slate-800">
                  {formatCurrency(cashier.revenue)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Filter tabs + search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={tab.onClick}
              className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                tab.active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.iconName ? <PremiumIcon name={tab.iconName} className="mr-1.5 inline h-4 w-4" /> : null}
              {tab.label}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders, customers, cashiers..."
          className="h-11 w-full max-w-sm rounded-2xl"
        />
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500">
        Showing {filtered.length} orders · {formatCurrency(totalRevenue)} revenue
      </p>

      {/* Orders table */}
      <div className="rounded-[1.35rem] border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-5 py-4 font-semibold text-slate-600">Order</th>
              <th className="px-4 py-4 font-semibold text-slate-600">Source</th>
              <th className="px-4 py-4 font-semibold text-slate-600">Customer</th>
              <th className="hidden px-4 py-4 font-semibold text-slate-600 lg:table-cell">Cashier</th>
              <th className="px-4 py-4 font-semibold text-slate-600">Time</th>
              <th className="hidden px-4 py-4 font-semibold text-slate-600 md:table-cell">Payment</th>
              <th className="px-4 py-4 text-right font-semibold text-slate-600">Total</th>
              <th className="px-4 py-4 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center text-slate-500">
                  <p className="text-lg font-semibold text-slate-700">No orders found</p>
                  <p className="mt-1">Try adjusting the filters or make a sale first.</p>
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/80"
                >
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs font-semibold tracking-wide text-slate-900">
                      {order.orderNumber}
                    </span>
                  </td>
                  <td className="px-4 py-4">{getSourceBadge(order)}</td>
                  <td className="px-4 py-4 text-slate-700">
                    {order.guestName ? (
                      <span>{order.guestName} <span className="text-xs text-slate-400">(guest)</span></span>
                    ) : (
                      order.customerName || "Walk-in Customer"
                    )}
                  </td>
                  <td className="hidden px-4 py-4 text-slate-600 lg:table-cell">
                    {order.channel === "pos" ? (order.cashierName || "Cashier") : "Self-service"}
                  </td>
                  <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                    {formatCambodiaTime(order.createdAt)}
                  </td>
                  <td className="hidden px-4 py-4 text-slate-600 md:table-cell">
                    <PaymentLabel method={order.paymentMethodLabel} />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {formatCurrency(order.totalAmount)}
                  </td>
                  <td className="px-4 py-4">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Receipt Drawer */}
      {selectedOrder ? (
        <ReceiptDrawer order={selectedOrder} onClose={() => setSelectedOrderId(null)} />
      ) : null}
    </>
  );
}

/* ─── Receipt Drawer ─── */

function ReceiptDrawer({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const subtotal = order.subtotalAmount;
  const tax = order.taxAmount;
  const discount = order.discountAmount;
  const total = order.totalAmount;
  const printableNotes = getPrintableOrderNotes(order);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[450px] animate-[pos-drawer-slide-in_220ms_ease-out] flex-col border-l border-slate-200 bg-white shadow-[-30px_0_80px_-38px_rgba(15,23,42,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Receipt</p>
              <h3 className="mt-2 font-mono text-lg font-semibold text-slate-950">{order.orderNumber}</h3>
              <p className="mt-1 text-sm text-slate-500">{formatCambodiaTime(order.createdAt)}</p>
            </div>
            <Button type="button" variant="ghost" onClick={onClose} className="border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100">
              <PremiumIcon name="close" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Meta section */}
          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Source</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                <PremiumIcon
                  name={order.channel === "pos" ? "pos" : "online"}
                  className="h-4 w-4 text-slate-500"
                />
                {order.channel === "pos" ? "POS Sale" : "Online Order"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Customer</span>
              <span className="font-medium text-slate-900">
                {order.guestName
                  ? `${order.guestName} (guest)`
                  : order.customerName || "Walk-in Customer"}
              </span>
            </div>
            {order.guestPhone ? (
              <div className="flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="font-medium text-slate-900">{order.guestPhone}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier</span>
              <span className="font-medium text-slate-900">
                {order.channel === "pos" ? (order.cashierName || "Cashier") : "Online (self-service)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment</span>
              <span className="font-medium text-slate-900">
                <PaymentLabel method={order.paymentMethodLabel} />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <OrderStatusBadge status={order.status} />
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Items</p>
            <div className="mt-3 space-y-3">
              {order.items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                  No item details available
                </p>
              ) : (
                order.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3">
                    <div>
                      <p className="font-medium text-slate-900">{item.productName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        x{item.quantity} · {formatCurrency(item.unitPrice)} ea
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tax (10%)</span>
              <span className="text-slate-900">{formatCurrency(tax)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="text-rose-600">-{formatCurrency(discount)}</span>
              </div>
            ) : null}
            <div className="border-t border-slate-200 pt-2 flex justify-between">
              <span className="font-semibold text-slate-900">TOTAL</span>
              <span className="text-xl font-bold text-slate-950">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Notes */}
          {printableNotes ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notes</p>
              <p className="mt-2 text-sm text-slate-700">{printableNotes}</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => printReceiptFromData(orderToPrintPayload(order))}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <PremiumIcon name="print" className="h-4 w-4" />
            Print
          </Button>
          <Button type="button" onClick={onClose} className="bg-teal-700 text-white hover:bg-teal-600">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
