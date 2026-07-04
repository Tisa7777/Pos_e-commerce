"use client";

import { PremiumIcon } from "@/components/ui/premium-icon";
import type { PaymentMethodDatum } from "@/types/domain";

export function PaymentMethodBreakdown({
  methods,
  sourceFilter,
}: {
  methods: PaymentMethodDatum[];
  sourceFilter: "all" | "pos" | "online";
}) {
  const totalRevenue = methods.reduce((sum, method) => {
    if (sourceFilter === "pos") return sum + method.posAmount;
    if (sourceFilter === "online") return sum + method.onlineAmount;
    return sum + method.totalAmount;
  }, 0);

  const barColors = ["#0f766e", "#3b82f6", "#8b5cf6"];

  return (
    <div className="surface flex h-full flex-col rounded-2xl border border-white/60 p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-1">
        <h3 className="text-lg font-semibold text-slate-950">Payment Methods</h3>
        <p className="text-sm text-slate-500">How customers are paying today</p>
      </div>

      <div className="mt-4 space-y-5">
        {methods.map((method, index) => {
          const amount =
            sourceFilter === "pos"
              ? method.posAmount
              : sourceFilter === "online"
                ? method.onlineAmount
                : method.totalAmount;
          const payments = method.totalPayments;
          const percentage = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;

          return (
            <div key={method.method}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PremiumIcon name={method.iconName} className="h-4 w-4 text-slate-500" />
                  <span className="font-semibold text-slate-950">{method.method}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-700">
                  ${amount.toFixed(2)}
                </span>
              </div>
              <p className="mb-1.5 text-xs text-slate-400">
                {payments} payments · {percentage.toFixed(0)}% of revenue
              </p>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: barColors[index % barColors.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* POS vs Online split table */}
      {sourceFilter === "all" && (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400"></th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <PremiumIcon name="pos" className="h-3.5 w-3.5" />
                    POS
                  </span>
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <PremiumIcon name="online" className="h-3.5 w-3.5" />
                    Online
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method.method} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <PremiumIcon name={method.iconName} className="h-3.5 w-3.5 text-slate-500" />
                      {method.method}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">
                    ${method.posAmount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">
                    ${method.onlineAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-slate-950">TOTAL</td>
                <td className="px-3 py-2 text-right font-mono text-slate-950">
                  ${methods.reduce((s, m) => s + m.posAmount, 0).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-slate-950">
                  ${methods.reduce((s, m) => s + m.onlineAmount, 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
