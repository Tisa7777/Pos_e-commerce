"use client";

import { format } from "date-fns";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { cn, formatCurrency } from "@/lib/utils";
import type { PosShiftSummary } from "@/types/domain";

export function ShiftCloseReport({ shifts }: { shifts: PosShiftSummary[] }) {
  const openShifts = shifts.filter((shift) => shift.status === "open");
  const closedShifts = shifts.filter((shift) => shift.status === "closed");
  const totalSales = shifts.reduce((sum, shift) => sum + shift.totalSalesAmount, 0);
  const totalCash = shifts.reduce((sum, shift) => sum + shift.cashSalesAmount, 0);
  const totalDifference = closedShifts.reduce(
    (sum, shift) => sum + (shift.cashDifference ?? 0),
    0,
  );

  return (
    <div className="surface rounded-[1.8rem] border border-white/60 p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PremiumIcon name="cash" className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-950">Shift Closing Report</h3>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Track open drawers, closed shifts, expected cash, counted cash, and over/short differences.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryPill label="Open" value={String(openShifts.length)} />
          <SummaryPill label="Closed" value={String(closedShifts.length)} />
          <SummaryPill label="Cash" value={formatCurrency(totalCash)} />
          <SummaryPill
            label="Difference"
            value={formatCurrency(totalDifference)}
            tone={totalDifference === 0 ? "neutral" : totalDifference > 0 ? "positive" : "negative"}
          />
        </div>
      </div>

      {shifts.length === 0 ? (
        <div className="mt-6 rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">No shifts in this date range.</p>
          <p className="mt-1 text-sm text-slate-400">
            Open a POS shift from the register to start tracking drawer totals.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[1.4rem] border border-slate-100 bg-white">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.15fr_0.7fr_0.85fr_0.85fr_0.85fr_0.85fr_0.85fr_0.9fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <span>Cashier</span>
              <span>Status</span>
              <span className="text-right">Orders</span>
              <span className="text-right">Sales</span>
              <span className="text-right">Cash sales</span>
              <span className="text-right">Expected</span>
              <span className="text-right">Counted</span>
              <span className="text-right">Difference</span>
            </div>

            <div className="divide-y divide-slate-100">
              {shifts.map((shift) => (
                <div key={shift.id} className="px-4 py-4 hover:bg-slate-50/70">
                  <div className="grid grid-cols-[1.15fr_0.7fr_0.85fr_0.85fr_0.85fr_0.85fr_0.85fr_0.9fr] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {shift.cashierName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {format(new Date(shift.openedAt), "MMM d, h:mm a")}
                        {shift.closedAt ? ` to ${format(new Date(shift.closedAt), "h:mm a")}` : " - still open"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
                        shift.status === "open"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      {shift.status}
                    </span>
                    <span className="text-right font-mono text-sm font-semibold text-slate-700">
                      {shift.orderCount}
                    </span>
                    <span className="text-right font-mono text-sm font-semibold text-slate-950">
                      {formatCurrency(shift.totalSalesAmount)}
                    </span>
                    <span className="text-right font-mono text-sm font-semibold text-slate-700">
                      {formatCurrency(shift.cashSalesAmount)}
                    </span>
                    <span className="text-right font-mono text-sm font-semibold text-slate-700">
                      {formatCurrency(shift.expectedCash ?? shift.openingCash + shift.cashSalesAmount)}
                    </span>
                    <span className="text-right font-mono text-sm font-semibold text-slate-700">
                      {shift.closingCash === null || shift.closingCash === undefined
                        ? "-"
                        : formatCurrency(shift.closingCash)}
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-sm font-semibold",
                        !shift.cashDifference
                          ? "text-slate-500"
                          : shift.cashDifference > 0
                            ? "text-emerald-700"
                            : "text-rose-700",
                      )}
                    >
                      {shift.cashDifference === null || shift.cashDifference === undefined
                        ? "-"
                        : formatCurrency(shift.cashDifference)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                    <p>Opening cash: {formatCurrency(shift.openingCash)}</p>
                    <p>Card: {formatCurrency(shift.cardSalesAmount)}</p>
                    <p>QR: {formatCurrency(shift.qrSalesAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-sm text-slate-500">
        Total shift sales: <span className="font-mono font-semibold text-slate-950">{formatCurrency(totalSales)}</span>
      </p>
    </div>
  );
}

function SummaryPill({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "positive" | "negative";
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-sm font-semibold",
          tone === "positive"
            ? "text-emerald-700"
            : tone === "negative"
              ? "text-rose-700"
              : "text-slate-950",
        )}
      >
        {value}
      </p>
    </div>
  );
}
