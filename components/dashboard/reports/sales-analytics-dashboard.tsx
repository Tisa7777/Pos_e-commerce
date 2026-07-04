"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { format } from "date-fns";
import { PremiumIcon } from "@/components/ui/premium-icon";
import type { PremiumIconName } from "@/lib/premium-icons";
import type { AnalyticsDashboardData, AnalyticsKpi } from "@/types/domain";
import type { ReportExportData } from "@/lib/export/csv";
import { fetchReportDataAction } from "@/app/actions/reports";
import { KpiStatCard } from "./kpi-stat-card";
import { RevenueChart } from "./revenue-chart";
import { PaymentMethodBreakdown } from "./payment-method-breakdown";
import { TopProductsList } from "./top-products-list";
import { PosVsOnlineComparison } from "./pos-vs-online-comparison";
import { RecentOrdersTable } from "./recent-orders-table";
import { CategoryRevenueChart } from "./category-revenue-chart";
import { ExportBar } from "./export-bar";
import { CashierPerformanceCard } from "./cashier-performance-card";
import { ShiftCloseReport } from "./shift-close-report";

type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "custom";
type SourceFilter = "all" | "pos" | "online";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
];

const SOURCE_OPTIONS: { value: SourceFilter; label: string; iconName: PremiumIconName }[] = [
  { value: "all", label: "All Sales", iconName: "all-sales" },
  { value: "pos", label: "POS Only", iconName: "pos" },
  { value: "online", label: "Online Only", iconName: "online" },
];

function getDateLabel(preset: DatePreset): string {
  const map: Record<DatePreset, string> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    this_month: "This Month",
    custom: "Custom Range",
  };
  return map[preset];
}

function getSourceLabel(source: SourceFilter): string {
  const map: Record<SourceFilter, string> = {
    all: "All sources",
    pos: "POS only",
    online: "Online only",
  };
  return map[source];
}

export function SalesAnalyticsDashboard({ data: initialData }: { data: AnalyticsDashboardData }) {
  const [data, setData] = useState<AnalyticsDashboardData>(initialData);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [isPending, startTransition] = useTransition();

  const lastUpdatedFormatted = format(new Date(data.lastUpdated), "MMM d, yyyy h:mm a");

  const handleDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;

    startTransition(async () => {
      const result = await fetchReportDataAction(preset);
      if (result.ok && result.data) {
        setData(result.data);
      }
    });
  }, []);

  // Compute filtered KPIs based on source filter
  const filteredKpis = useMemo((): AnalyticsKpi[] => {
    if (sourceFilter === "all") return data.kpis;

    const posRevenue = data.posSummary.revenue;
    const onlineRevenue = data.onlineSummary.revenue;
    const posOrders = data.posSummary.orders;
    const onlineOrders = data.onlineSummary.orders;

    const revenue = sourceFilter === "pos" ? posRevenue : onlineRevenue;
    const orders = sourceFilter === "pos" ? posOrders : onlineOrders;
    const avgOrder = orders > 0 ? revenue / orders : 0;

    return data.kpis.map((kpi) => {
      if (kpi.label === "Revenue") {
        return { ...kpi, value: revenue, formattedValue: `$${revenue.toFixed(2)}` };
      }
      if (kpi.label === "Orders") {
        return { ...kpi, value: orders, formattedValue: String(orders) };
      }
      if (kpi.label === "Avg Order") {
        return { ...kpi, value: avgOrder, formattedValue: `$${avgOrder.toFixed(2)}` };
      }
      if (kpi.label === "Cashiers") {
        const activeCashiers = sourceFilter === "online" ? 0 : data.cashierPerformance.length;
        return { ...kpi, value: activeCashiers, formattedValue: String(activeCashiers) };
      }
      return kpi; // Low Stock stays the same
    });
  }, [data, sourceFilter]);

  // Compute filtered totals for export bar
  const filteredTotals = useMemo(() => {
    if (sourceFilter === "all") {
      return { revenue: data.totalRevenue, orders: data.totalOrders };
    }
    if (sourceFilter === "pos") {
      return { revenue: data.posSummary.revenue, orders: data.posSummary.orders };
    }
    return { revenue: data.onlineSummary.revenue, orders: data.onlineSummary.orders };
  }, [data, sourceFilter]);

  // Build export data for CSV
  const exportData = useMemo((): ReportExportData => {
    return {
      dateLabel: getDateLabel(datePreset),
      sourceLabel: getSourceLabel(sourceFilter),
      totalRevenue: filteredTotals.revenue,
      totalOrders: filteredTotals.orders,
      kpis: filteredKpis.map((kpi) => ({
        label: kpi.label,
        formattedValue: kpi.formattedValue,
      })),
      topProducts: data.topProducts.map((p) => ({
        name: p.name,
        unitsSold: p.unitsSold,
        revenue: p.revenue,
      })),
      recentOrders: data.recentOrders.map((o) => ({
        orderNumber: o.orderNumber,
        channel: o.source,
        status: o.status,
        totalAmount: o.total,
        customerName: o.customerName,
        createdAt: o.time,
      })),
      cashierPerformance: data.cashierPerformance.map((c) => ({
        name: c.cashierName,
        salesCount: c.orders,
        revenue: c.revenue,
      })),
      paymentMethods: data.paymentMethods.map((m) => ({
        method: m.method,
        count: m.totalPayments,
        total: m.totalAmount,
      })),
      categoryBreakdown: data.categoryBreakdown.map((c) => ({
        name: c.label,
        revenue: c.posRevenue + c.onlineRevenue,
        orders: 0,
      })),
    };
  }, [data, filteredKpis, filteredTotals, datePreset, sourceFilter]);

  return (
    <div className="space-y-6 pb-20">
      {/* ═══════ PAGE HEADER + FILTERS ═══════ */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Reporting
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Sales Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Last updated: {lastUpdatedFormatted}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          {/* Date range filter */}
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleDatePreset(preset.value)}
                disabled={isPending}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  datePreset === preset.value
                    ? "bg-primary text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                } ${isPending ? "opacity-60 cursor-wait" : ""}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Source toggle */}
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSourceFilter(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  sourceFilter === opt.value
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <PremiumIcon name={opt.iconName} className="h-4 w-4" />
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-3 text-sm font-medium text-primary">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading {getDateLabel(datePreset).toLowerCase()} report…
        </div>
      )}

      {/* ═══════ ROW 1 — KPI STATS ═══════ */}
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 transition-opacity ${isPending ? "opacity-50" : ""}`}>
        {filteredKpis.map((kpi) => (
          <KpiStatCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      {/* ═══════ ROW 2 — REVENUE CHART ═══════ */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <RevenueChart timeline={data.revenueTimeline} sourceFilter={sourceFilter} />
      </div>


      {/* ═══════ ROW 3 — PAYMENT METHODS + TOP PRODUCTS ═══════ */}
      <div className={`grid gap-6 lg:grid-cols-[55%_1fr] transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <PaymentMethodBreakdown methods={data.paymentMethods} sourceFilter={sourceFilter} />
        <TopProductsList products={data.topProducts} />
      </div>

      {/* ═══════ ROW 4 — POS vs ONLINE ═══════ */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <h3 className="mb-4 text-lg font-semibold text-slate-950">POS vs Online Sales</h3>
        <PosVsOnlineComparison
          posSummary={data.posSummary}
          onlineSummary={data.onlineSummary}
          sourceFilter={sourceFilter}
        />
      </div>

      {/* ═══════ ROW 5 — CASHIER PERFORMANCE ═══════ */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <CashierPerformanceCard
          cashiers={data.cashierPerformance}
          sourceFilter={sourceFilter}
        />
      </div>

      {/* ═══════ ROW 6 — SHIFT CLOSING REPORT ═══════ */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <ShiftCloseReport shifts={sourceFilter === "online" ? [] : data.posShifts} />
      </div>

      {/* ═══════ ROW 7 — RECENT ORDERS TABLE ═══════ */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <RecentOrdersTable orders={data.recentOrders} sourceFilter={sourceFilter} />
      </div>

      {/* ═══════ ROW 8 — SALES BY CATEGORY ═══════ */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <CategoryRevenueChart categories={data.categoryBreakdown} sourceFilter={sourceFilter} />
      </div>

      {/* ═══════ EXPORT BAR ═══════ */}
      <ExportBar
        totalOrders={filteredTotals.orders}
        totalRevenue={filteredTotals.revenue}
        dateLabel={getDateLabel(datePreset)}
        sourceLabel={getSourceLabel(sourceFilter)}
        exportData={exportData}
      />
    </div>
  );
}
