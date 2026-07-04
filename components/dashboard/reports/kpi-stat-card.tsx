"use client";

import { PremiumIcon } from "@/components/ui/premium-icon";
import type { AnalyticsKpi } from "@/types/domain";

function Sparkline({ series, color }: { series: number[]; color: string }) {
  const max = Math.max(...series, 1);
  return (
    <div className="mt-2 flex items-end gap-[3px]" style={{ height: 24 }}>
      {series.map((value, index) => (
        <div
          key={index}
          className="flex-1 rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max(4, (value / max) * 100)}%`,
            backgroundColor: index === series.length - 1 ? color : `${color}40`,
          }}
        />
      ))}
    </div>
  );
}

export function KpiStatCard({ kpi }: { kpi: AnalyticsKpi }) {
  const isPositive = kpi.direction === "up";
  const isNegative = kpi.direction === "down";

  // For "Low Stock", down is good (inverted)
  const trendColor = kpi.invertColor
    ? isNegative
      ? "text-emerald-600"
      : isPositive
        ? "text-red-500"
        : "text-slate-400"
    : isPositive
      ? "text-emerald-600"
      : isNegative
        ? "text-red-500"
        : "text-slate-400";

  const sparklineColor = kpi.invertColor
    ? isNegative
      ? "#059669"
      : "#ef4444"
    : isPositive
      ? "#059669"
      : isNegative
        ? "#ef4444"
        : "#94a3b8";

  const arrow = isPositive ? "↑" : isNegative ? "↓" : "";
  const roundedChange = Math.round(Math.abs(kpi.changePercent) * 10) / 10;
  const changeDisplay = kpi.invertColor
    ? `${arrow} ${roundedChange}`
    : `${arrow} +${roundedChange}%`;

  return (
    <div className="surface group rounded-2xl border border-white/60 p-5 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] transition-shadow duration-200 hover:shadow-[0_25px_60px_-25px_rgba(15,23,42,0.4)]">
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <PremiumIcon name={kpi.iconName} className="h-4 w-4" />
          {kpi.label}
        </p>
      </div>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-slate-950">
        {kpi.formattedValue}
      </p>
      <div className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
        <span>{changeDisplay}</span>
        <span className="text-xs text-slate-400">{kpi.changeLabel}</span>
      </div>
      <Sparkline series={kpi.series} color={sparklineColor} />
    </div>
  );
}
