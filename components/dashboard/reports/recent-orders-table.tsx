"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { PremiumIcon } from "@/components/ui/premium-icon";
import type { AnalyticsRecentOrder } from "@/types/domain";

type OrderFilter = "all" | "pos" | "online" | "processing" | "completed";

export function RecentOrdersTable({
  orders,
  sourceFilter,
}: {
  orders: AnalyticsRecentOrder[];
  sourceFilter: "all" | "pos" | "online";
}) {
  const [tableFilter, setTableFilter] = useState<OrderFilter>("all");

  const sourceFiltered = useMemo(() => {
    if (sourceFilter === "pos") return orders.filter((o) => o.source === "pos");
    if (sourceFilter === "online") return orders.filter((o) => o.source === "ecommerce");
    return orders;
  }, [orders, sourceFilter]);

  const filtered = useMemo(() => {
    if (tableFilter === "all") return sourceFiltered;
    if (tableFilter === "pos") return sourceFiltered.filter((o) => o.source === "pos");
    if (tableFilter === "online") return sourceFiltered.filter((o) => o.source === "ecommerce");
    if (tableFilter === "processing") return sourceFiltered.filter((o) => o.status === "processing");
    if (tableFilter === "completed") return sourceFiltered.filter((o) => o.status === "completed");
    return sourceFiltered;
  }, [sourceFiltered, tableFilter]);

  const filterButtons: { value: OrderFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pos", label: "POS" },
    { value: "online", label: "Online" },
    { value: "processing", label: "Processing" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <div className="surface rounded-2xl border border-white/60 p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-950">Recent Orders</h3>
        <a
          href="/admin/orders"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all orders →
        </a>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setTableFilter(btn.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tableFilter === btn.value
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-500 hover:text-slate-700"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Order ID
              </th>
              <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Source
              </th>
              <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Customer
              </th>
              <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Time
              </th>
              <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Items
              </th>
              <th className="pb-3 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Payment
              </th>
              <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order, index) => (
              <tr
                key={order.id}
                className={`border-b border-slate-100 transition-colors hover:bg-slate-50/70 ${
                  index % 2 === 1 ? "bg-slate-50/40" : ""
                }`}
              >
                <td className="py-3 pr-3">
                  <div>
                    <span className="font-semibold text-slate-950">{order.orderNumber}</span>
                    <div className="mt-0.5">
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <SourceBadge source={order.source} />
                </td>
                <td className="py-3 pr-3 text-slate-700">{order.customerName}</td>
                <td className="py-3 pr-3 font-mono text-xs text-slate-500">
                  {format(new Date(order.time), "h:mm a")}
                </td>
                <td className="py-3 pr-3 text-slate-500">{order.itemCount} items</td>
                <td className="py-3 pr-3 text-slate-700">
                  <span className="inline-flex items-center gap-1.5">
                    <PremiumIcon name={order.paymentIconName} className="h-3.5 w-3.5 text-slate-500" />
                    {order.paymentMethod}
                  </span>
                </td>
                <td className="py-3 text-right font-mono font-semibold text-slate-950">
                  ${order.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">No orders match this filter.</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-amber-50 text-amber-700 border-amber-200",
    refunded: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        styles[status] ?? styles.processing
      }`}
    >
      {status}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isPOS = source === "pos";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
        isPOS
          ? "border-primary/20 bg-primary/5 text-primary"
          : "border-amber-300/30 bg-amber-50 text-amber-700"
      }`}
    >
      <PremiumIcon name={isPOS ? "pos" : "online"} className="h-3.5 w-3.5" />
      {isPOS ? "POS" : "Online"}
    </span>
  );
}
