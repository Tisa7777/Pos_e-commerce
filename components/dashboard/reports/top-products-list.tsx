"use client";

import { useState } from "react";
import { PremiumIcon, RankIcon } from "@/components/ui/premium-icon";
import type { TopProductDatum } from "@/types/domain";

type SortMode = "units" | "revenue";

export function TopProductsList({ products }: { products: TopProductDatum[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("units");

  const sorted = [...products].sort((a, b) =>
    sortMode === "units" ? b.unitsSold - a.unitsSold : b.revenue - a.revenue,
  );

  const maxValue =
    sortMode === "units"
      ? Math.max(...sorted.map((p) => p.unitsSold), 1)
      : Math.max(...sorted.map((p) => p.revenue), 1);

  return (
    <div className="surface flex h-full flex-col rounded-2xl border border-white/60 p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Top Products</h3>
          <p className="text-sm text-slate-500">By {sortMode === "units" ? "units sold" : "revenue"} today</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setSortMode("units")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              sortMode === "units"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            By Units
          </button>
          <button
            onClick={() => setSortMode("revenue")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              sortMode === "revenue"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            By Revenue
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {sorted.map((product, index) => {
          const value = sortMode === "units" ? product.unitsSold : product.revenue;
          const percentage = (value / maxValue) * 100;

          return (
            <div key={product.id}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                    {index < 3 ? (
                      <RankIcon rank={index} className="h-3.5 w-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <PremiumIcon name={product.iconName} className="h-4 w-4 text-slate-500" />
                  <span className="font-semibold text-slate-950">{product.name}</span>
                </div>
              </div>
              <p className="mb-1.5 ml-8 text-xs text-slate-400">
                {product.unitsSold} units · ${product.revenue.toFixed(2)}
              </p>
              <div className="ml-8 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
