"use client";

import { PremiumIcon } from "@/components/ui/premium-icon";
import type { PosVsOnlineSummary } from "@/types/domain";

export function PosVsOnlineComparison({
  posSummary,
  onlineSummary,
  sourceFilter,
}: {
  posSummary: PosVsOnlineSummary;
  onlineSummary: PosVsOnlineSummary;
  sourceFilter: "all" | "pos" | "online";
}) {
  if (sourceFilter === "pos") {
    return (
      <div className="grid grid-cols-1">
        <SummaryCard type="pos" summary={posSummary} />
      </div>
    );
  }

  if (sourceFilter === "online") {
    return (
      <div className="grid grid-cols-1">
        <SummaryCard type="online" summary={onlineSummary} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SummaryCard type="pos" summary={posSummary} />
      <SummaryCard type="online" summary={onlineSummary} />
    </div>
  );
}

function SummaryCard({
  type,
  summary,
}: {
  type: "pos" | "online";
  summary: PosVsOnlineSummary;
}) {
  const isPOS = type === "pos";

  return (
    <div
      className={`surface rounded-2xl border p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] ${
        isPOS
          ? "border-l-4 border-l-primary/60 border-t-white/60 border-r-white/60 border-b-white/60 bg-primary/[0.03]"
          : "border-l-4 border-l-amber-400/60 border-t-white/60 border-r-white/60 border-b-white/60 bg-amber-50/40"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <PremiumIcon
          name={isPOS ? "pos" : "online"}
          className={isPOS ? "h-5 w-5 text-primary" : "h-5 w-5 text-amber-600"}
        />
        <h3 className="text-lg font-semibold text-slate-950">
          {isPOS ? "POS / Cashier" : "Online Storefront"}
        </h3>
      </div>

      <div className="space-y-3">
        <Row label="Revenue" value={`$${summary.revenue.toFixed(2)}`} mono />
        <Row label="Orders" value={String(summary.orders)} mono />
        <Row label="Avg order" value={`$${summary.avgOrder.toFixed(2)}`} mono />
        <Row label="Top item" value={summary.topItem} />
        <Row label="Peak hour" value={summary.peakHour} />
        {isPOS && summary.cashierName && (
          <Row label="Cashier" value={summary.cashierName} />
        )}
        {!isPOS && <Row label="" value="(self-service)" muted />}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-sm font-semibold ${
          muted ? "text-slate-400 italic" : mono ? "font-mono text-slate-950" : "text-slate-950"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
