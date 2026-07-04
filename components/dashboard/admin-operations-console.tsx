"use client";

import Link from "next/link";
import { format, isToday, startOfDay } from "date-fns";
import { startTransition, useState, type SVGProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  CategorySalesDatum,
  DashboardMetricSnapshot,
  HourlySalesDatum,
  TopSellingProductDatum,
} from "@/lib/services/reports";
import type { OrderDetail, ProductCardData } from "@/types/domain";

interface AdminOperationsConsoleProps {
  metrics: DashboardMetricSnapshot;
  recentOrders: OrderDetail[];
  lowStock: ProductCardData[];
  categorySales: CategorySalesDatum[];
  hourlySales: HourlySalesDatum[];
  topProducts: TopSellingProductDatum[];
}

type OrderFilter = "all" | "today" | "pending";
type IconProps = SVGProps<SVGSVGElement>;

const KPI_META = [
  {
    key: "revenue" as const,
    label: "Revenue Today",
    tone: "teal" as const,
    icon: WalletIcon,
  },
  {
    key: "orders" as const,
    label: "Orders Today",
    tone: "blue" as const,
    icon: ShoppingBagIcon,
  },
  {
    key: "average" as const,
    label: "Average Order Value",
    tone: "violet" as const,
    icon: GaugeIcon,
  },
  {
    key: "lowStock" as const,
    label: "Low-Stock Items",
    tone: "rose" as const,
    icon: AlertTriangleIcon,
  },
];

export function AdminOperationsConsole({
  metrics,
  recentOrders,
  lowStock,
  categorySales,
  hourlySales,
  topProducts,
}: AdminOperationsConsoleProps) {
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  const filteredOrders = recentOrders.filter((order) => {
    if (orderFilter === "today") {
      return isToday(new Date(order.createdAt));
    }

    if (orderFilter === "pending") {
      return getOperationsStatus(order).label === "pending";
    }

    return true;
  });

  const categoryMax = Math.max(...categorySales.map((item) => item.revenue), 1);

  return (
    <div className="space-y-6 pb-6 animate-in fade-in duration-300">
      <section className="rounded-[2rem] border border-black/[0.04] bg-white p-8 shadow-[var(--shadow-elevated)] ring-1 ring-black/[0.02]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              <span className="inline-block h-1 w-4 rounded-full bg-primary/40" />
              Admin dashboard
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#0c1712] sm:text-4xl">
              Operations console
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              Monitor revenue, low-stock pressure, recent orders, and sales patterns from one place.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <Link
              href="/admin/orders"
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-[#0c1712] px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-teal-900 hover:shadow-[0_14px_32px_-18px_rgba(13,148,136,0.75)]"
            >
              <ShoppingBagIcon className="h-5 w-5" />
              Review Orders
            </Link>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryChip
                label="Alerts"
                value={String(lowStock.length)}
                helper={lowStock.length > 0 ? "Need stock attention" : "All good"}
              />
              <SummaryChip
                label="Pending"
                value={String(recentOrders.filter((order) => getOperationsStatus(order).label === "pending").length)}
                helper="Recent orders in progress"
              />
              <SummaryChip
                label="Last sync"
                value={format(startOfDay(new Date()), "MMM d")}
                helper="Today's operational view"
              />
              <SummaryChip
                label="Drink sizes"
                value="M / L"
                helper="L charges $1 more"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={KPI_META[0].label}
          value={formatCurrency(metrics.revenueToday)}
          tone={KPI_META[0].tone}
          trend={metrics.revenueTrend}
          icon={<WalletIcon className="h-5 w-5" />}
        />
        <KpiCard
          label={KPI_META[1].label}
          value={String(metrics.ordersToday)}
          tone={KPI_META[1].tone}
          trend={metrics.ordersTrend}
          icon={<ShoppingBagIcon className="h-5 w-5" />}
        />
        <KpiCard
          label={KPI_META[2].label}
          value={formatCurrency(metrics.averageOrderValue)}
          tone={KPI_META[2].tone}
          trend={metrics.averageOrderTrend}
          icon={<GaugeIcon className="h-5 w-5" />}
        />
        <KpiCard
          label={KPI_META[3].label}
          value={String(metrics.lowStockCount)}
          tone={KPI_META[3].tone}
          trend={metrics.lowStockTrend}
          icon={<AlertTriangleIcon className="h-5 w-5" />}
          invertTrendMeaning
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="rounded-[2rem] border border-black/[0.04] bg-white shadow-[var(--shadow-elevated)] ring-1 ring-black/[0.02] overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-black/[0.04] bg-slate-50/50 px-8 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                Recent orders
              </p>
              <h2 className="mt-2 font-serif text-xl font-semibold text-[#0c1712]">Live order queue</h2>
              <p className="mt-2 text-sm text-muted">
                Click any row to inspect totals, items, and notes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["all", "today", "pending"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    startTransition(() => setOrderFilter(filter));
                  }}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200",
                    orderFilter === filter
                      ? "bg-[#0c1712] text-white shadow-sm"
                      : "bg-[#f5f8f6] text-muted hover:bg-slate-100 hover:text-[#0c1712]",
                  )}
                >
                  {filter === "all" ? "All" : filter === "today" ? "Today" : "Pending"}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length > 0 ? (
            <>
              <div className="overflow-x-auto px-2 py-2">
                <Table>
                  <THead>
                    <TR>
                      <TH>Order ID</TH>
                      <TH>Customer</TH>
                      <TH>Time</TH>
                      <TH>Items</TH>
                      <TH>Total</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody className="divide-y divide-black/[0.04]">
                    {filteredOrders.map((order) => {
                      const status = getOperationsStatus(order);
                      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

                      return (
                        <TR
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="cursor-pointer transition-colors hover:bg-black/[0.015]"
                        >
                          <TD className="font-semibold text-[#0c1712]">{order.orderNumber}</TD>
                          <TD>
                            <div>
                              <p className="font-medium text-[#0c1712]">
                                {order.customerName ?? "Walk-in"}
                              </p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">
                                {order.channel}
                              </p>
                            </div>
                          </TD>
                          <TD className="text-muted">{format(new Date(order.createdAt), "h:mm a")}</TD>
                          <TD className="text-muted">{itemCount}</TD>
                          <TD className="font-mono font-semibold text-primary">
                            {formatCurrency(order.totalAmount)}
                          </TD>
                          <TD>
                            <StatusPill label={status.label} tone={status.tone} />
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t border-black/[0.04] px-8 py-5 bg-slate-50/30">
                <p className="text-sm text-muted">
                  Showing {filteredOrders.length} recent orders
                </p>
                <Link
                  href="/admin/orders"
                  className="text-sm font-semibold text-primary hover:text-teal-800"
                >
                  View all orders {"->"}
                </Link>
              </div>
            </>
          ) : (
            <div className="px-8 py-16">
              <div className="rounded-[1.5rem] border border-dashed border-black/[0.08] bg-[#f8faf9] px-6 py-16 text-center">
                <p className="text-lg font-semibold text-[#0c1712]">
                  {orderFilter === "pending"
                    ? "No pending orders — you're all caught up."
                    : "No orders found for this filter."}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {orderFilter === "pending"
                    ? "New sales will appear here as soon as they need attention."
                    : "Try switching filters or review the full orders page."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-black/[0.04] bg-white shadow-[var(--shadow-elevated)] ring-1 ring-black/[0.02] overflow-hidden">
          <div className="border-b border-black/[0.04] bg-slate-50/50 px-8 py-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose-600">
              Low-stock watchlist
            </p>
            <h2 className="mt-2 font-serif text-xl font-semibold text-[#0c1712]">Critical inventory</h2>
            <p className="mt-2 text-sm text-muted">
              Products nearing threshold with quick restock shortcuts.
            </p>
          </div>

          <div className="space-y-4 px-8 py-6">
            {lowStock.length > 0 ? (
              lowStock.slice(0, 6).map((product) => {
                const status = getStockStatus(product.stockQuantity, product.lowStockThreshold);
                const progress = Math.min(
                  (product.stockQuantity / Math.max(product.lowStockThreshold * 1.5, 1)) * 100,
                  100,
                );

                return (
                  <div
                    key={product.id}
                    className="rounded-[1.5rem] border border-black/[0.04] bg-[#f5f8f6] px-5 py-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#0c1712]">{product.name}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="font-mono uppercase">{product.sku}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span className="rounded-full bg-white border border-black/[0.06] px-2 py-1 text-[11px] font-medium text-[#0c1712] shadow-sm">
                            {product.category?.name ?? "General"}
                          </span>
                        </div>
                      </div>
                      <Link
                        href="/admin/inventory"
                        className="rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-[#0c1712] shadow-sm hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        Restock
                      </Link>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>
                          {product.stockQuantity} in stock / threshold {product.lowStockThreshold}
                        </span>
                        <span
                          className={cn(
                            "font-semibold",
                            status.tone === "danger" && "text-rose-700",
                            status.tone === "warning" && "text-amber-700",
                            status.tone === "success" && "text-emerald-700",
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-200">
                        <div
                          className={cn(
                            "h-2 rounded-full",
                            status.tone === "danger" && "bg-rose-500",
                            status.tone === "warning" && "bg-amber-500",
                            status.tone === "success" && "bg-emerald-500",
                          )}
                          style={{ width: `${Math.max(progress, 8)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <p className="text-lg font-semibold text-slate-950">Inventory looks healthy</p>
                <p className="mt-2 text-sm text-slate-500">
                  No products are below their alert thresholds right now.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-black/[0.04] bg-slate-50/30 px-8 py-5">
            <Link
              href="/admin/inventory"
              className="text-sm font-semibold text-primary hover:text-teal-800"
            >
              View all inventory {"->"}
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-black/[0.04] bg-white shadow-[var(--shadow-elevated)] ring-1 ring-black/[0.02] overflow-hidden">
        <div className="border-b border-black/[0.04] bg-slate-50/50 px-8 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Analytics strip
          </p>
          <h2 className="mt-2 font-serif text-xl font-semibold text-[#0c1712]">Performance patterns</h2>
          <p className="mt-2 text-sm text-muted">
            Minimal charts for category mix, hourly momentum, and top products.
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.05fr_1.15fr_0.9fr]">
          <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Sales by category</p>
                <p className="mt-1 text-xs text-slate-500">Revenue mix</p>
              </div>
              <BarChartIcon className="h-5 w-5 text-teal-600" />
            </div>

            <div className="mt-6 space-y-4">
              {categorySales.map((category) => (
                <div key={category.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{category.label}</span>
                    <span className="font-mono text-slate-950">
                      {formatCurrency(category.revenue)}
                    </span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-200">
                    <div
                      className="h-3 rounded-full bg-teal-600"
                      style={{
                        width: `${Math.max((category.revenue / categoryMax) * 100, 10)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Hourly sales heatmap</p>
                <p className="mt-1 text-xs text-slate-500">Today</p>
              </div>
              <ClockIcon className="h-5 w-5 text-amber-600" />
            </div>

            <div className="mt-6 grid grid-cols-6 gap-2 xl:grid-cols-12">
              {hourlySales.map((hour) => (
                <div
                  key={hour.hourLabel}
                  className="rounded-xl border border-slate-200 p-2 text-center"
                  style={{
                    backgroundColor: `rgba(13, 148, 136, ${0.08 + hour.intensity * 0.8})`,
                  }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-600">
                    {hour.hourLabel.slice(0, 2)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-900">
                    {hour.orderCount}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </div>

          <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Top 5 products</p>
                <p className="mt-1 text-xs text-slate-500">Best sellers</p>
              </div>
              <TrophyIcon className="h-5 w-5 text-violet-600" />
            </div>

            <div className="mt-6 space-y-3">
              {topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      #{index + 1}
                    </p>
                    <p className="mt-1 truncate font-medium text-slate-950">{product.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-slate-950">
                      {product.unitsSold} sold
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCurrency(product.revenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedOrder ? (
        <>
          <button
            type="button"
            onClick={() => setSelectedOrder(null)}
            className="fixed inset-0 z-40 bg-slate-950/25"
            aria-label="Close order detail"
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg border-l border-slate-200 bg-white shadow-[0_40px_120px_-36px_rgba(15,23,42,0.35)]">
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-teal-700">
                      Order detail
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                      {selectedOrder.orderNumber}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {selectedOrder.customerName ?? "Walk-in"} •{" "}
                      {format(new Date(selectedOrder.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 hover:bg-white hover:text-slate-950"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailStat label="Channel" value={selectedOrder.channel} />
                  <DetailStat
                    label="Status"
                    value={getOperationsStatus(selectedOrder).label}
                  />
                  <DetailStat
                    label="Total"
                    value={formatCurrency(selectedOrder.totalAmount)}
                  />
                </div>

                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">Items</p>
                  <div className="mt-4 space-y-3">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-slate-950">{item.productName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                            {item.sku}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            Qty {item.quantity} • {formatCurrency(item.unitPrice)} each
                          </p>
                        </div>
                        <p className="font-mono text-sm font-semibold text-slate-950">
                          {formatCurrency(item.lineTotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">Totals</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatCurrency(selectedOrder.subtotalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Discount</span>
                      <span className="font-mono">-{formatCurrency(selectedOrder.discountAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tax</span>
                      <span className="font-mono">{formatCurrency(selectedOrder.taxAmount)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-[0.2em] text-slate-700">
                          Grand total
                        </span>
                        <span className="font-mono text-xl font-semibold text-slate-950">
                          {formatCurrency(selectedOrder.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes ? (
                  <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">Notes</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{selectedOrder.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  trend,
  icon,
  tone,
  invertTrendMeaning = false,
}: {
  label: string;
  value: string;
  trend: DashboardMetricSnapshot["revenueTrend"];
  icon: React.ReactNode;
  tone: "teal" | "blue" | "violet" | "rose";
  invertTrendMeaning?: boolean;
}) {
  const trendIsPositive = invertTrendMeaning
    ? trend.currentValue <= trend.previousValue
    : trend.currentValue >= trend.previousValue;
  const isFlat = trend.direction === "flat";

  return (
    <div className="rounded-[1.75rem] border border-black/[0.04] bg-white p-6 shadow-[var(--shadow-card)] ring-1 ring-black/[0.02] transition-all hover:-translate-y-1 hover:shadow-[0_28px_60px_-38px_rgba(15,23,42,0.22)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-[#0c1712]">{value}</p>
        </div>
        <div
          className={cn(
            "rounded-2xl p-3 shadow-sm",
            tone === "teal" && "bg-teal-50 text-teal-700 ring-1 ring-teal-200/50",
            tone === "blue" && "bg-blue-50 text-blue-700 ring-1 ring-blue-200/50",
            tone === "violet" && "bg-violet-50 text-violet-700 ring-1 ring-violet-200/50",
            tone === "rose" && "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50",
          )}
        >
          {icon}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
            isFlat && "bg-slate-100 text-slate-600",
            !isFlat && trendIsPositive && "bg-emerald-50 text-emerald-700",
            !isFlat && !trendIsPositive && "bg-rose-50 text-rose-700",
          )}
        >
          <span>{isFlat ? "→" : trend.currentValue >= trend.previousValue ? "↑" : "↓"}</span>
          <span>{formatChange(trend.changePercent)} vs yesterday</span>
        </div>
        <Sparkline
          values={trend.series}
          className={cn(
            tone === "teal" && "text-teal-600",
            tone === "blue" && "text-blue-600",
            tone === "violet" && "text-violet-600",
            tone === "rose" && "text-rose-600",
          )}
        />
      </div>
    </div>
  );
}

function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const width = 128;
  const height = 42;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-11 w-32", className)}>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function SummaryChip({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-black/[0.04] bg-[#f8faf9] px-5 py-5 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-[#0c1712]">{value}</p>
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: "completed" | "pending" | "refunded";
  tone: "success" | "warning" | "danger";
}) {
  return (
    <Badge tone={tone} className="capitalize">
      {label}
    </Badge>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function getOperationsStatus(order: OrderDetail) {
  if (
    order.status === "refunded" ||
    order.status === "cancelled" ||
    order.paymentStatus === "refunded"
  ) {
    return {
      label: "refunded" as const,
      tone: "danger" as const,
    };
  }

  if (order.status === "completed" || (order.channel === "pos" && order.paymentStatus === "paid")) {
    return {
      label: "completed" as const,
      tone: "success" as const,
    };
  }

  return {
    label: "pending" as const,
    tone: "warning" as const,
  };
}

function getStockStatus(stockQuantity: number, lowStockThreshold: number) {
  if (stockQuantity <= Math.max(1, Math.floor(lowStockThreshold * 0.5))) {
    return {
      label: "Critical",
      tone: "danger" as const,
    };
  }

  if (stockQuantity <= lowStockThreshold) {
    return {
      label: "Low",
      tone: "warning" as const,
    };
  }

  return {
    label: "Healthy",
    tone: "success" as const,
  };
}

function formatChange(value: number) {
  const rounded = Math.abs(value);

  if (!Number.isFinite(rounded) || rounded === 0) {
    return "0%";
  }

  return `${rounded.toFixed(0)}%`;
}

function WalletIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M16 12h4v4h-4a2 2 0 0 1 0-4Z" />
      <path d="M6 5V4a1 1 0 0 1 1.2-.98l9.3 1.86" />
    </svg>
  );
}

function ShoppingBagIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function GaugeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M20 14a8 8 0 1 0-16 0" />
      <path d="m12 14 4-4" />
      <path d="M12 14h.01" />
    </svg>
  );
}

function AlertTriangleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m12 3 9 16H3L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function BarChartIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 20V9" />
      <path d="M12 20V4" />
      <path d="M19 20v-6" />
    </svg>
  );
}

function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function TrophyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
      <path d="M6 4H4a2 2 0 0 0 0 4h2" />
      <path d="M18 4h2a2 2 0 1 1 0 4h-2" />
      <path d="M12 11v4" />
      <path d="M8 21h8" />
      <path d="M10 15h4l1 6H9l1-6Z" />
    </svg>
  );
}
