"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartOptions, TooltipItem } from "chart.js";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Minus,
  Printer,
} from "lucide-react";
import { Bar } from "react-chartjs-2";
import { PremiumIcon } from "@/components/ui/premium-icon";
import type {
  PeriodComparisonData,
  PeriodComparisonMetric,
  PeriodComparisonProductMover,
  PeriodComparisonSegment,
  PeriodComparisonSource,
  PeriodComparisonTopProduct,
} from "@/types/domain";
import type { PremiumIconName } from "@/lib/premium-icons";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const SOURCE_OPTIONS: Array<{
  value: PeriodComparisonSource;
  label: string;
  iconName: PremiumIconName;
}> = [
  { value: "all", label: "All Sales", iconName: "all-sales" },
  { value: "pos", label: "POS", iconName: "pos" },
  { value: "online", label: "Online", iconName: "online" },
];

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(value))}`;
}

function getSegment(
  comparison: PeriodComparisonData,
  sourceFilter: PeriodComparisonSource,
) {
  return (
    comparison.segments.find((segment) => segment.source === sourceFilter) ??
    comparison.segments.find((segment) => segment.source === "all")
  );
}

function csvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function buildComparisonCsv(
  comparisons: PeriodComparisonData[],
  sourceFilter: PeriodComparisonSource,
) {
  const rows: Array<Array<string | number>> = [
    ["Section", "Period", "Source", "Name", "Current", "Previous", "Change"],
  ];

  for (const comparison of comparisons) {
    const segment = getSegment(comparison, sourceFilter);
    if (!segment) continue;

    for (const metric of segment.metrics) {
      rows.push([
        "Metric",
        `${comparison.currentLabel} vs ${comparison.previousLabel}`,
        segment.sourceLabel,
        metric.label,
        metric.currentValue,
        metric.previousValue,
        `${metric.changePercent}%`,
      ]);
    }

    for (const product of segment.productMovers) {
      rows.push([
        "Product mover",
        `${comparison.currentLabel} vs ${comparison.previousLabel}`,
        segment.sourceLabel,
        product.name,
        product.currentRevenue,
        product.previousRevenue,
        product.revenueDelta,
      ]);
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function ChangeIndicator({
  changePercent,
  direction,
}: {
  changePercent: number;
  direction: "up" | "down" | "flat";
}) {
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  const className =
    direction === "up"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : direction === "down"
        ? "bg-rose-50 text-rose-600 ring-rose-100"
        : "bg-slate-100 text-slate-500 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {direction === "flat" ? "0%" : `${Math.abs(changePercent)}%`}
    </span>
  );
}

function ComparisonChart({
  comparison,
  segment,
}: {
  comparison: PeriodComparisonData;
  segment: PeriodComparisonSegment;
}) {
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        align: "end" as const,
        labels: {
          usePointStyle: true,
          pointStyle: "rectRounded",
          padding: 16,
          font: { size: 11, family: "DM Sans" },
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        titleFont: { size: 13, family: "DM Sans" },
        bodyFont: { size: 12, family: "IBM Plex Mono" },
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label(context: TooltipItem<"bar">) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 11, family: "DM Sans" },
          color: "#94a3b8",
          maxRotation: 0,
        },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(15, 23, 42, 0.05)" },
        ticks: {
          font: { size: 11, family: "IBM Plex Mono" },
          color: "#94a3b8",
          callback(value: string | number) {
            return `$${Number(value).toLocaleString()}`;
          },
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  const data = {
    labels: comparison.dailyLabels,
    datasets: [
      {
        label: comparison.previousLabel,
        data: segment.previousDailyRevenue,
        backgroundColor: "rgba(148, 163, 184, 0.38)",
        borderColor: "rgba(148, 163, 184, 0.78)",
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.72,
        categoryPercentage: 0.74,
      },
      {
        label: comparison.currentLabel,
        data: segment.currentDailyRevenue,
        backgroundColor: "rgba(15, 118, 110, 0.58)",
        borderColor: "rgba(15, 118, 110, 0.95)",
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.72,
        categoryPercentage: 0.74,
      },
    ],
  };

  return (
    <div className="h-[260px] min-w-0">
      <Bar data={data} options={options} />
    </div>
  );
}

function MetricTile({ metric }: { metric: PeriodComparisonMetric }) {
  return (
    <div className="min-w-0 px-4 py-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {metric.label}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <span className="text-lg font-bold text-slate-950">
          {metric.formattedCurrent}
        </span>
        <ChangeIndicator
          changePercent={metric.changePercent}
          direction={metric.direction}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        was {metric.formattedPrevious}
      </p>
    </div>
  );
}

function InsightList({ segment }: { segment: PeriodComparisonSegment }) {
  const toneClass = {
    positive: "text-emerald-700 bg-emerald-50",
    negative: "text-rose-600 bg-rose-50",
    warning: "text-amber-700 bg-amber-50",
    neutral: "text-slate-600 bg-slate-100",
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Insights
          </p>
          <h4 className="mt-1 text-base font-semibold text-slate-950">
            What changed
          </h4>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {segment.sourceLabel}
        </span>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl bg-slate-50/80">
        {segment.insights.map((insight) => (
          <div key={`${insight.title}-${insight.value}`} className="flex gap-3 p-4">
            <span
              className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass[insight.tone]}`}
            >
              <PremiumIcon name={insight.iconName} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {insight.title}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                {insight.value}
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {insight.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelLabel({ channel }: { channel: "pos" | "online" | "both" }) {
  const label = channel === "both" ? "Both" : channel === "pos" ? "POS" : "Online";
  const iconName: PremiumIconName =
    channel === "both" ? "all-sales" : channel === "pos" ? "pos" : "online";

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
      <PremiumIcon name={iconName} className="h-3 w-3" />
      {label}
    </span>
  );
}

function ProductMoverRow({ product }: { product: PeriodComparisonProductMover }) {
  const isUp = product.direction === "up";
  const Icon = isUp ? ArrowUpRight : product.direction === "down" ? ArrowDownRight : Minus;

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <PremiumIcon name={product.iconName} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">
            {product.name}
          </p>
          <ChannelLabel channel={product.channel} />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {product.currentUnits} units now vs {product.previousUnits} before
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`inline-flex items-center justify-end gap-1 text-sm font-semibold ${
            isUp ? "text-emerald-700" : product.direction === "down" ? "text-rose-600" : "text-slate-500"
          }`}
        >
          <Icon className="h-4 w-4" />
          {formatSignedCurrency(product.revenueDelta)}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-400">
          {product.direction === "flat" ? "0%" : `${Math.abs(product.changePercent)}%`}
        </p>
      </div>
    </div>
  );
}

function ProductMovers({ segment }: { segment: PeriodComparisonSegment }) {
  const gains = segment.productMovers
    .filter((product) => product.direction === "up")
    .slice(0, 4);
  const drops = segment.productMovers
    .filter((product) => product.direction === "down")
    .slice(0, 4);

  return (
    <div className="min-w-0">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Product Movers
        </p>
        <h4 className="mt-1 text-base font-semibold text-slate-950">
          Biggest increases and decreases
        </h4>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-emerald-700">
            <ArrowUpRight className="h-4 w-4" />
            Increases
          </div>
          <div className="divide-y divide-slate-100">
            {gains.length > 0 ? (
              gains.map((product) => (
                <ProductMoverRow key={product.id} product={product} />
              ))
            ) : (
              <p className="py-5 text-sm text-slate-400">No product increases yet.</p>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-semibold text-rose-600">
            <ArrowDownRight className="h-4 w-4" />
            Decreases
          </div>
          <div className="divide-y divide-slate-100">
            {drops.length > 0 ? (
              drops.map((product) => (
                <ProductMoverRow key={product.id} product={product} />
              ))
            ) : (
              <p className="py-5 text-sm text-slate-400">No product decreases yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopProductRow({
  product,
  index,
  maxRevenue,
}: {
  product: PeriodComparisonTopProduct;
  index: number;
  maxRevenue: number;
}) {
  const percentage = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;

  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
          {index + 1}
        </span>
        <PremiumIcon name={product.iconName} className="h-4 w-4 text-slate-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">
            {product.name}
          </p>
          <p className="text-xs text-slate-400">
            {product.unitsSold} units - {formatCurrency(product.revenue)}
          </p>
        </div>
        <ChannelLabel channel={product.channel} />
      </div>
      <div className="ml-14 mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(4, percentage)}%` }}
        />
      </div>
    </div>
  );
}

function TopProducts({ segment }: { segment: PeriodComparisonSegment }) {
  const maxRevenue = Math.max(...segment.topProducts.map((product) => product.revenue), 0);

  return (
    <div className="min-w-0">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Current Leaders
        </p>
        <h4 className="mt-1 text-base font-semibold text-slate-950">
          Top products this period
        </h4>
      </div>
      <div className="divide-y divide-slate-100">
        {segment.topProducts.length > 0 ? (
          segment.topProducts.map((product, index) => (
            <TopProductRow
              key={product.id}
              product={product}
              index={index}
              maxRevenue={maxRevenue}
            />
          ))
        ) : (
          <p className="py-5 text-sm text-slate-400">No products sold in this view.</p>
        )}
      </div>
    </div>
  );
}

function ComparisonCard({
  comparison,
  sourceFilter,
}: {
  comparison: PeriodComparisonData;
  sourceFilter: PeriodComparisonSource;
}) {
  const segment = getSegment(comparison, sourceFilter);
  const revenueMetric = segment?.metrics.find((metric) => metric.label === "Revenue");

  if (!segment) {
    return null;
  }

  return (
    <div className="surface overflow-hidden rounded-2xl border border-white/60 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.25)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-slate-950">
              {comparison.currentLabel} vs {comparison.previousLabel}
            </h4>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {segment.sourceLabel}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              {comparison.currentDateRange}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
              {comparison.previousDateRange}
            </span>
          </div>
        </div>

        {revenueMetric && (
          <ChangeIndicator
            changePercent={revenueMetric.changePercent}
            direction={revenueMetric.direction}
          />
        )}
      </div>

      <div className="grid divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {segment.metrics.map((metric) => (
          <MetricTile key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">Total:</span>{" "}
              <span className="font-mono font-semibold text-slate-950">
                {formatCurrency(segment.currentRevenue)}
              </span>
              <span className="mx-2 text-slate-300">vs</span>
              <span className="font-mono">{formatCurrency(segment.previousRevenue)}</span>
            </div>
            <div className="text-xs text-slate-400">
              {segment.currentOrders} orders - {segment.currentUnits} units
            </div>
          </div>
          <ComparisonChart comparison={comparison} segment={segment} />
        </div>

        <InsightList segment={segment} />
      </div>

      <div className="grid gap-6 border-t border-slate-100 px-6 py-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <ProductMovers segment={segment} />
        <TopProducts segment={segment} />
      </div>
    </div>
  );
}

export function PeriodComparisonSection({
  comparisons,
}: {
  comparisons: PeriodComparisonData[];
}) {
  const [sourceFilter, setSourceFilter] = useState<PeriodComparisonSource>("all");
  const selectedSourceLabel = useMemo(
    () =>
      SOURCE_OPTIONS.find((option) => option.value === sourceFilter)?.label ?? "All Sales",
    [sourceFilter],
  );

  function handleExportCsv() {
    const csv = buildComparisonCsv(comparisons, sourceFilter);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `period-comparison-${sourceFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!comparisons || comparisons.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Performance Comparison
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            Period-over-period analysis
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Compare matched selling windows across all sales channels.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {SOURCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSourceFilter(option.value)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all ${
                  sourceFilter === option.value
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <PremiumIcon name={option.iconName} className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm hover:border-primary/30 hover:text-primary"
              title={`Export ${selectedSourceLabel} comparison CSV`}
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm hover:border-primary/30 hover:text-primary"
              title="Print or save as PDF"
            >
              <Printer className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {comparisons.map((comparison) => (
          <ComparisonCard
            key={`${comparison.currentLabel}-${comparison.previousLabel}`}
            comparison={comparison}
            sourceFilter={sourceFilter}
          />
        ))}
      </div>
    </div>
  );
}
