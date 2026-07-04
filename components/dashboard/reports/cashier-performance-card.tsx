"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { PremiumIcon, RankIcon } from "@/components/ui/premium-icon";
import { cn, formatCurrency } from "@/lib/utils";
import type { CashierSalesDatum } from "@/types/domain";

type CashierSortMode = "revenue" | "orders" | "avgOrder" | "unitsSold";

const SORT_OPTIONS: Array<{ value: CashierSortMode; label: string }> = [
  { value: "revenue", label: "Revenue" },
  { value: "orders", label: "Orders" },
  { value: "avgOrder", label: "Avg order" },
  { value: "unitsSold", label: "Units" },
];

export function CashierPerformanceCard({
  cashiers,
  sourceFilter,
}: {
  cashiers: CashierSalesDatum[];
  sourceFilter: "all" | "pos" | "online";
}) {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<CashierSortMode>("revenue");

  const totalRevenue = cashiers.reduce((sum, cashier) => sum + cashier.revenue, 0);
  const totalOrders = cashiers.reduce((sum, cashier) => sum + cashier.orders, 0);
  const totalUnits = cashiers.reduce((sum, cashier) => sum + cashier.unitsSold, 0);
  const teamAvgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const maxRevenue = Math.max(...cashiers.map((cashier) => cashier.revenue), 1);
  const topCashier = cashiers[0];
  const highestAvgCashier = [...cashiers].sort(
    (left, right) => right.avgOrder - left.avgOrder || right.revenue - left.revenue,
  )[0];
  const productLeader = [...cashiers].sort(
    (left, right) => right.topProductUnits - left.topProductUnits || right.revenue - left.revenue,
  )[0];
  const biggestTicketCashier = [...cashiers].sort(
    (left, right) => right.largestOrderTotal - left.largestOrderTotal,
  )[0];

  const visibleCashiers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cashiers
      .filter((cashier) => {
        if (!query) return true;

        return [
          cashier.cashierName,
          cashier.topProductName,
          cashier.largestOrderNumber,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const primary = right[sortMode] - left[sortMode];
        return primary || right.revenue - left.revenue || right.orders - left.orders;
      });
  }, [cashiers, search, sortMode]);

  function handleExportCashiers() {
    const rows = visibleCashiers.map((cashier, index) => [
      index + 1,
      cashier.cashierName,
      cashier.orders,
      cashier.revenue.toFixed(2),
      cashier.avgOrder.toFixed(2),
      cashier.unitsSold,
      cashier.topProductName ?? "No product",
      cashier.topProductUnits,
      cashier.largestOrderNumber ?? "",
      cashier.largestOrderTotal.toFixed(2),
      cashier.lastSaleAt ? format(new Date(cashier.lastSaleAt), "yyyy-MM-dd HH:mm") : "",
    ]);

    const header = [
      "Rank",
      "Cashier",
      "Orders",
      "Revenue",
      "Average Order",
      "Units Sold",
      "Top Product",
      "Top Product Units",
      "Largest Order",
      "Largest Order Total",
      "Last Sale",
    ];
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `cashier-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="surface overflow-hidden rounded-[1.8rem] border border-white/60 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)]">
      <div className="relative border-b border-slate-200/70 bg-[linear-gradient(135deg,#0f766e_0%,#115e59_48%,#13352f_100%)] px-6 py-6 text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-50">
              <PremiumIcon name="customers" className="h-4 w-4" />
              Cashier Sales Report
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">
              Who sold, what moved, and who is leading
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50/80">
              POS orders are grouped by the cashier selected at checkout, so you can compare
              revenue, order count, units sold, best item, and biggest ticket for this date range.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4 xl:min-w-[520px]">
            <SummaryPill label="Cashiers" value={String(cashiers.length)} dark />
            <SummaryPill label="POS orders" value={String(totalOrders)} dark />
            <SummaryPill label="Units" value={String(totalUnits)} dark />
            <SummaryPill label="Revenue" value={formatCurrency(totalRevenue)} dark />
          </div>
        </div>
      </div>

      {sourceFilter === "online" ? (
        <EmptyState
          title="Cashier sales are tracked on POS orders."
          detail="Switch to All Sales or POS Only to review cashier totals."
        />
      ) : cashiers.length === 0 ? (
        <EmptyState
          title="No cashier sales found."
          detail="Completed POS orders will appear here after cashiers sell items."
        />
      ) : (
        <div className="space-y-6 p-6">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <TopCashierPanel cashier={topCashier} teamAvgOrder={teamAvgOrder} />

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <InsightCard
                label="Highest avg order"
                value={highestAvgCashier ? formatCurrency(highestAvgCashier.avgOrder) : "$0.00"}
                detail={highestAvgCashier?.cashierName ?? "No cashier"}
                iconName="avg-order"
              />
              <InsightCard
                label="Top item owner"
                value={productLeader?.topProductName ?? "No product"}
                detail={
                  productLeader
                    ? `${productLeader.cashierName} - ${productLeader.topProductUnits} units`
                    : "No item sales"
                }
                iconName="package"
              />
              <InsightCard
                label="Biggest ticket"
                value={biggestTicketCashier ? formatCurrency(biggestTicketCashier.largestOrderTotal) : "$0.00"}
                detail={
                  biggestTicketCashier
                    ? `${biggestTicketCashier.cashierName} - ${formatOrderNumber(biggestTicketCashier.largestOrderNumber)}`
                    : "No ticket yet"
                }
                iconName="receipt"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              icon={<PremiumIcon name="search" className="h-4 w-4" />}
              placeholder="Search cashier, top product, or order number..."
              className="h-12 rounded-2xl border-slate-200 bg-white lg:w-[360px]"
            />

            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSortMode(option.value)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                      sortMode === option.value
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleExportCashiers}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-950"
              >
                <PremiumIcon name="csv" className="h-4 w-4" />
                Export cashier CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[1.4rem] border border-slate-100 bg-white">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[0.42fr_1.45fr_0.7fr_0.86fr_0.82fr_0.76fr_1.1fr_0.9fr_0.9fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span>Rank</span>
                <span>Cashier</span>
                <span className="text-right">Orders</span>
                <span className="text-right">Revenue</span>
                <span className="text-right">Avg</span>
                <span className="text-right">Units</span>
                <span>Top product</span>
                <span>Biggest</span>
                <span className="text-right">Last sale</span>
              </div>

              <div className="divide-y divide-slate-100">
                {visibleCashiers.map((cashier, index) => {
                  const width = (cashier.revenue / maxRevenue) * 100;
                  const isAboveTeamAverage = cashier.avgOrder >= teamAvgOrder && cashier.orders > 0;

                  return (
                    <div key={cashier.cashierId} className="px-4 py-4 hover:bg-slate-50/70">
                      <div className="grid grid-cols-[0.42fr_1.45fr_0.7fr_0.86fr_0.82fr_0.76fr_1.1fr_0.9fr_0.9fr] items-center gap-3">
                        <div>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
                            {index < 3 ? (
                              <RankIcon rank={index} className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-sm font-bold text-teal-700 ring-1 ring-teal-100">
                              {getInitials(cashier.cashierName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">
                                {cashier.cashierName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatSaleWindow(cashier.firstSaleAt, cashier.lastSaleAt)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <span className="text-right font-mono text-sm font-semibold text-slate-700">
                          {cashier.orders}
                        </span>
                        <span className="text-right font-mono text-sm font-semibold text-slate-950">
                          {formatCurrency(cashier.revenue)}
                        </span>
                        <span
                          className={cn(
                            "text-right font-mono text-sm font-semibold",
                            isAboveTeamAverage ? "text-emerald-700" : "text-slate-700",
                          )}
                        >
                          {formatCurrency(cashier.avgOrder)}
                        </span>
                        <span className="text-right font-mono text-sm font-semibold text-slate-700">
                          {cashier.unitsSold}
                        </span>
                        <span className="min-w-0 text-sm text-slate-700">
                          <span className="block truncate font-medium text-slate-900">
                            {cashier.topProductName ?? "No product"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {cashier.topProductUnits} units
                          </span>
                        </span>
                        <span className="text-sm text-slate-700">
                          <span className="block font-mono font-semibold text-slate-950">
                            {formatCurrency(cashier.largestOrderTotal)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatOrderNumber(cashier.largestOrderNumber)}
                          </span>
                        </span>
                        <span className="text-right text-xs font-medium text-slate-500">
                          {cashier.lastSaleAt ? format(new Date(cashier.lastSaleAt), "MMM d, h:mm a") : "No sale"}
                        </span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#14b8a6,#0f766e)] transition-all duration-500"
                          style={{ width: `${Math.max(5, width)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {visibleCashiers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No cashier matches this search.</p>
              <p className="mt-1 text-sm text-slate-400">Try another cashier name, product, or order number.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TopCashierPanel({
  cashier,
  teamAvgOrder,
}: {
  cashier: CashierSalesDatum;
  teamAvgOrder: number;
}) {
  return (
    <div className="rounded-[1.5rem] border border-teal-100 bg-[linear-gradient(135deg,#f0fdfa_0%,#ffffff_62%)] p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
            Top cashier
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-teal-700 text-lg font-bold text-white shadow-[0_18px_38px_-24px_rgba(15,118,110,0.62)]">
              {getInitials(cashier.cashierName)}
            </span>
            <div>
              <h4 className="text-2xl font-semibold tracking-tight text-slate-950">
                {cashier.cashierName}
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                {cashier.orders} orders - {cashier.unitsSold} units - {cashier.sharePercent.toFixed(0)}% of POS revenue
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-white px-5 py-4 text-right shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Revenue
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold text-teal-700">
            {formatCurrency(cashier.revenue)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="Avg order" value={formatCurrency(cashier.avgOrder)} tone={cashier.avgOrder >= teamAvgOrder ? "positive" : "neutral"} />
        <Metric label="Top product" value={cashier.topProductName ?? "No product"} detail={`${cashier.topProductUnits} units`} />
        <Metric label="Biggest ticket" value={formatCurrency(cashier.largestOrderTotal)} detail={formatOrderNumber(cashier.largestOrderNumber)} />
        <Metric label="Last sale" value={cashier.lastSaleAt ? format(new Date(cashier.lastSaleAt), "h:mm a") : "No sale"} detail={cashier.lastSaleAt ? format(new Date(cashier.lastSaleAt), "MMM d") : undefined} />
      </div>
    </div>
  );
}

function SummaryPill({
  dark = false,
  label,
  value,
}: {
  dark?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("rounded-2xl px-3 py-3", dark ? "border border-white/12 bg-white/10" : "bg-slate-50")}>
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", dark ? "text-teal-50/70" : "text-slate-400")}>
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-sm font-semibold", dark ? "text-white" : "text-slate-950")}>{value}</p>
    </div>
  );
}

function InsightCard({
  detail,
  iconName,
  label,
  value,
}: {
  detail: string;
  iconName: "avg-order" | "package" | "receipt";
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 truncate text-lg font-semibold text-slate-950">{value}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{detail}</p>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <PremiumIcon name={iconName} className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function Metric({
  detail,
  label,
  tone = "neutral",
  value,
}: {
  detail?: string;
  label: string;
  tone?: "neutral" | "positive";
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className={cn("mt-2 truncate font-semibold", tone === "positive" ? "text-emerald-700" : "text-slate-950")}>
        {value}
      </p>
      {detail ? <p className="mt-1 truncate text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="p-6">
      <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function escapeCsvCell(value: string) {
  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function formatOrderNumber(orderNumber?: string | null) {
  if (!orderNumber) {
    return "No order";
  }

  const segments = orderNumber.split("-");
  return `#${segments.at(-1) ?? orderNumber}`;
}

function formatSaleWindow(firstSaleAt?: string | null, lastSaleAt?: string | null) {
  if (!firstSaleAt && !lastSaleAt) {
    return "No sale window";
  }

  if (!firstSaleAt || !lastSaleAt || firstSaleAt === lastSaleAt) {
    return lastSaleAt ? `Sold at ${format(new Date(lastSaleAt), "h:mm a")}` : "One sale";
  }

  return `${format(new Date(firstSaleAt), "h:mm a")} to ${format(new Date(lastSaleAt), "h:mm a")}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
