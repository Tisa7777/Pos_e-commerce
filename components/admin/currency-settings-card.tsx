"use client";

import { useState, useTransition } from "react";
import { updateCurrencySettingsAction } from "@/app/actions/currency-actions";
import { formatCurrency, formatKhr } from "@/lib/utils";

export function CurrencySettingsCard({
  initialRate,
  initialShowKhr,
  initialTaxPercent,
}: {
  initialRate: number;
  initialShowKhr: boolean;
  initialTaxPercent: number;
}) {
  const [rate, setRate] = useState(String(initialRate));
  const [showKhr, setShowKhr] = useState(initialShowKhr);
  const [taxPercent, setTaxPercent] = useState(String(initialTaxPercent));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const numericRate = Number(rate) || 0;
  const numericTax = Number(taxPercent) || 0;
  const previewPrice = 5.5;
  const previewTax = previewPrice * (numericTax / 100);
  const previewTotal = previewPrice + previewTax;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateCurrencySettingsAction(formData);
      setMessage({
        tone: result.ok ? "success" : "error",
        text: result.message,
      });
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-[2rem] border border-black/[0.04] bg-white shadow-[var(--shadow-card)] ring-1 ring-black/[0.02]"
    >
      <div className="border-b border-black/[0.04] bg-slate-50/50 px-6 py-4">
        <h3 className="text-[15px] font-semibold text-slate-950">
          Store Settings
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Configure currency exchange rate and tax for POS
        </p>
      </div>

      <div className="space-y-6 px-6 py-5">
        {/* --- Tax Section --- */}
        <div className="space-y-2">
          <label
            htmlFor="taxPercent"
            className="block font-mono text-[11px] uppercase tracking-[0.2em] text-teal-700"
          >
            Tax Rate (%)
          </label>
          <div className="relative max-w-xs">
            <input
              id="taxPercent"
              name="taxPercent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-10 font-mono text-lg text-slate-950 shadow-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-200/50"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
              %
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Applied to all POS sales. Set to 0 to disable tax.
          </p>
        </div>

        <div className="h-px bg-slate-100" />

        {/* --- Currency Section --- */}
        <div className="space-y-2">
          <label
            htmlFor="khrRate"
            className="block font-mono text-[11px] uppercase tracking-[0.2em] text-teal-700"
          >
            Exchange Rate (1 USD = ? KHR)
          </label>
          <div className="relative max-w-xs">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
              ៛
            </span>
            <input
              id="khrRate"
              name="khrRate"
              type="number"
              min="1"
              step="1"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-4 font-mono text-lg text-slate-950 shadow-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-200/50"
            />
          </div>
        </div>

        {/* Show KHR Toggle */}
        <div className="flex items-center gap-3">
          <input
            id="showKhr"
            name="showKhr"
            type="checkbox"
            checked={showKhr}
            onChange={(e) => setShowKhr(e.target.checked)}
            className="h-5 w-5 rounded-lg border-slate-300 text-teal-600 focus:ring-teal-300"
          />
          <label htmlFor="showKhr" className="text-sm font-medium text-slate-700">
            Show KHR on POS receipts
          </label>
        </div>

        {/* Live Preview */}
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/60 to-emerald-50/40 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-700">
            Live Preview
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-600">Iced Latte (L)</span>
              <div className="text-right">
                <span className="font-mono font-semibold text-slate-950">
                  {formatCurrency(previewPrice)}
                </span>
                {showKhr && numericRate > 0 ? (
                  <span className="ml-2 font-mono text-xs text-teal-700">
                    {formatKhr(previewPrice, numericRate)}
                  </span>
                ) : null}
              </div>
            </div>
            {numericTax > 0 ? (
              <div className="flex items-baseline justify-between text-xs text-slate-500">
                <span>Tax ({numericTax}%)</span>
                <div className="text-right">
                  <span className="font-mono">{formatCurrency(previewTax)}</span>
                  {showKhr && numericRate > 0 ? (
                    <span className="ml-2 font-mono text-teal-600">
                      {formatKhr(previewTax, numericRate)}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="border-t border-dashed border-teal-200/60 pt-2">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-950">TOTAL</span>
                <div className="text-right">
                  <span className="font-mono text-xl font-bold text-teal-700">
                    {formatCurrency(previewTotal)}
                  </span>
                  {showKhr && numericRate > 0 ? (
                    <p className="font-mono text-sm font-semibold text-teal-600">
                      {formatKhr(previewTotal, numericRate)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {showKhr && numericRate > 0 ? (
              <p className="mt-1 text-right font-mono text-[10px] text-teal-600/70">
                Rate: 1 USD = ៛{numericRate.toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>

        {/* Message */}
        {message ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              message.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <div className="border-t border-black/[0.04] bg-slate-50/50 px-6 py-4">
        <button
          type="submit"
          disabled={isPending || numericRate <= 0}
          className="h-11 rounded-xl bg-teal-700 px-6 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
        >
          {isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
