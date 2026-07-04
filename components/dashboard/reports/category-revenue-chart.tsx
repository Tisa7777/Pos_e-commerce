"use client";

import { PremiumIcon } from "@/components/ui/premium-icon";
import type { CategorySalesSplitDatum } from "@/types/domain";

export function CategoryRevenueChart({
  categories,
  sourceFilter,
}: {
  categories: CategorySalesSplitDatum[];
  sourceFilter: "all" | "pos" | "online";
}) {
  const maxRevenue = Math.max(
    ...categories.map((cat) => {
      if (sourceFilter === "pos") return cat.posRevenue;
      if (sourceFilter === "online") return cat.onlineRevenue;
      return cat.posRevenue + cat.onlineRevenue;
    }),
    1,
  );

  const totalRevenue = categories.reduce((sum, cat) => {
    if (sourceFilter === "pos") return sum + cat.posRevenue;
    if (sourceFilter === "online") return sum + cat.onlineRevenue;
    return sum + cat.posRevenue + cat.onlineRevenue;
  }, 0);

  return (
    <div className="surface rounded-2xl border border-white/60 p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-1">
        <h3 className="text-lg font-semibold text-slate-950">Revenue by Category</h3>
        <p className="text-sm text-slate-500">Which category is performing best today</p>
      </div>

      <div className="mt-5 space-y-6">
        {categories.map((cat) => {
          const posRev = cat.posRevenue;
          const onlineRev = cat.onlineRevenue;
          const total =
            sourceFilter === "pos"
              ? posRev
              : sourceFilter === "online"
                ? onlineRev
                : posRev + onlineRev;
          const percentage = totalRevenue > 0 ? (total / totalRevenue) * 100 : 0;
          const barWidth = (total / maxRevenue) * 100;

          const posWidth = total > 0 ? (posRev / total) * barWidth : 0;
          const onlineWidth = total > 0 ? (onlineRev / total) * barWidth : 0;

          return (
            <div key={cat.label}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PremiumIcon name={cat.iconName} className="h-4 w-4 text-slate-500" />
                  <span className="font-semibold text-slate-950">{cat.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-slate-700">
                    ${total.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">({percentage.toFixed(0)}%)</span>
                </div>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                {sourceFilter === "all" ? (
                  <div className="flex h-full">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${posWidth}%` }}
                      title={`POS: $${posRev.toFixed(2)}`}
                    />
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${onlineWidth}%` }}
                      title={`Online: $${onlineRev.toFixed(2)}`}
                    />
                  </div>
                ) : (
                  <div
                    className={`h-full transition-all duration-500 ${
                      sourceFilter === "pos" ? "bg-primary" : "bg-amber-400"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {sourceFilter === "all" && (
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
            <span>POS Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
            <span>Online Sales</span>
          </div>
        </div>
      )}
    </div>
  );
}
