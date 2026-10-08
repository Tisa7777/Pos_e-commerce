import Image from "next/image";
import Link from "next/link";
import type { PropsWithChildren } from "react";
import { PremiumIcon } from "@/components/ui/premium-icon";
import type { PremiumIconName } from "@/lib/premium-icons";

const PERKS: Array<{ icon: PremiumIconName; label: string; hint: string }> = [
  { icon: "rocket", label: "Order ahead", hint: "Skip the queue" },
  { icon: "bell", label: "Pickup updates", hint: "Real-time alerts" },
  { icon: "trophy", label: "Loyalty rewards", hint: "Points every visit" },
];

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8faf9_0%,#eef7f4_56%,#fff7ed_100%)]">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.82fr)] lg:items-center lg:px-8">
        <section className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/70 bg-slate-950 shadow-[0_24px_80px_-48px_rgba(12,23,18,0.6)]">
          <Image
            src="/auth-cafe-hero.png"
            alt="A warm cafe counter with coffee, pastries, and a checkout terminal"
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,23,18,0.82)_0%,rgba(12,23,18,0.42)_52%,rgba(12,23,18,0.1)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,rgba(12,23,18,0)_0%,rgba(12,23,18,0.76)_100%)]" />

          <div className="relative z-10 flex min-h-[520px] flex-col justify-between p-5 text-white sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/" className="inline-flex items-center gap-3 group">
                <div className="rounded-lg bg-white px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-primary shadow-sm transition-all duration-300 group-hover:scale-105">
                  Coffee
                </div>
                <p className="font-serif text-xl font-semibold text-white">
                  Coffee Shop
                </p>
              </Link>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/12 px-4 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
              >
                <span aria-hidden="true">←</span>
                Back to storefront
              </Link>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/18 bg-white/12 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur-md">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300 animate-[pulse-soft_2s_ease-in-out_infinite]" />
                Member benefits
              </div>

              <h1 className="mt-5 max-w-2xl font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
                Your cafe account, ready before the first sip.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-white/78">
                Sign in to keep favorites close, reorder faster, and follow every pickup from cart to counter.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {PERKS.map((perk) => (
                  <div
                    key={perk.label}
                    className="group flex items-center gap-3 rounded-lg border border-white/14 bg-white/12 p-3.5 text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/18"
                  >
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm transition-transform duration-300 group-hover:scale-105">
                      <PremiumIcon name={perk.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{perk.label}</p>
                      <p className="text-xs text-white/65">{perk.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="space-y-4 lg:py-8">{children}</section>
      </div>
    </main>
  );
}
