import Link from "next/link";
import type { PropsWithChildren } from "react";
import { BackToPosLink } from "@/components/pos/back-to-pos-link";
import {
  CashierSelector,
  PosCashierProvider,
} from "@/components/pos/cashier-selector";
import { OnlineOrderNotifications } from "@/components/pos/online-order-notifications";
import type { AppProfile, PosCashierOption, PosShiftSummary } from "@/types/domain";

export function PosShell({
  children,
  profile,
  onlineOrderCount = 0,
  cashierOptions = [],
  openShifts = [],
}: PropsWithChildren<{
  profile: AppProfile;
  onlineOrderCount?: number;
  cashierOptions?: PosCashierOption[];
  openShifts?: PosShiftSummary[];
}>) {
  const defaultCashier: PosCashierOption = {
    id: profile.id,
    name: profile.fullName,
    profileId: profile.id,
    role: "cashier",
  };

  return (
    <PosCashierProvider
      options={cashierOptions}
      defaultCashier={defaultCashier}
      initialOpenShifts={openShifts}
    >
      <div className="relative min-h-screen bg-[#f5f8f6] text-slate-950">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.14),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.10),_transparent_20%),linear-gradient(180deg,_#f8faf9_0%,_#eef4f1_100%)]" />
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-2xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-[1750px] flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/admin"
                  className="group inline-flex h-10 items-center justify-center gap-2 rounded-full border border-black/[0.06] bg-white px-4 text-sm font-medium text-muted shadow-sm transition-all duration-300 hover:-translate-x-0.5 hover:border-primary/20 hover:bg-white hover:text-primary hover:shadow-[0_4px_14px_-4px_rgba(13,148,136,0.2)]"
                >
                  <svg
                    className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                    aria-hidden="true"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  <span>Owner</span>
                </Link>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-teal-200/70 bg-gradient-to-r from-teal-50 to-emerald-50 px-3.5 py-1.5 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500 shadow-[0_0_12px_rgba(13,148,136,0.45)]" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-teal-700">
                    POS register
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
                  Counter register
                </h1>
                <span className="hidden rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-600 shadow-sm md:inline">
                  Search / · Add ↵ · Checkout F
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <BackToPosLink />
              <Link
                href="/pos/online-orders"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-4 text-sm font-semibold text-amber-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_8px_24px_-12px_rgba(245,158,11,0.5)]"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/80 text-amber-600 shadow-sm">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h18M6 7V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2" />
                    <path d="M5 7v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7" />
                  </svg>
                </span>
                <span className="hidden sm:inline">Online orders</span>
                {onlineOrderCount > 0 ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-600 px-2 py-0.5 font-mono text-[11px] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(245,158,11,0.6)]">
                    {onlineOrderCount}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/pos/history"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white hover:text-primary hover:shadow-[0_8px_24px_-12px_rgba(13,148,136,0.35)]"
              >
                View history
              </Link>
              <CashierSelector
                options={cashierOptions}
                defaultCashier={defaultCashier}
              />
            </div>
          </div>
        </header>
        <main className="relative mx-auto max-w-[1750px] px-6 py-6">{children}</main>
        <OnlineOrderNotifications initialCount={onlineOrderCount} />
      </div>
    </PosCashierProvider>
  );
}
