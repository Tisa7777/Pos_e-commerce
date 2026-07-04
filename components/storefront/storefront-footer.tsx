import Link from "next/link";
import { PremiumIcon } from "@/components/ui/premium-icon";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Orders", href: "/orders" },
  { label: "About", href: "/#about" },
];

const HOURS = [
  { label: "Mon–Fri", value: "7:00 AM – 8:00 PM" },
  { label: "Sat–Sun", value: "8:00 AM – 6:00 PM" },
];

const SOCIALS = [
  { name: "camera" as const, label: "Instagram" },
  { name: "thumbs-up" as const, label: "Facebook" },
  { name: "music" as const, label: "TikTok" },
];

export function StorefrontFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-black/[0.05] bg-[#0c1712]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-teal-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-60 w-60 rounded-full bg-amber-500/[0.08] blur-[80px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"n\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"4\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23n)\"/%3E%3C/svg%3E')",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Link href="/" className="flex items-center gap-3 group w-fit">
            <div className="rounded-2xl bg-gradient-to-br from-primary to-teal-600 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-[0_4px_16px_-4px_rgba(13,148,136,0.5)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_8px_24px_-6px_rgba(13,148,136,0.6)]">
              Tisa
            </div>
            <p className="font-serif text-xl font-semibold text-white">Tisa Cafe</p>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/55">
            Fresh coffee, warm bakes, and easy pickup for busy Phnom Penh mornings.
          </p>
          <div className="mt-6 flex items-center gap-3">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href="#"
                aria-label={social.label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/15 hover:text-primary hover:shadow-[0_8px_24px_-10px_rgba(13,148,136,0.6)]"
              >
                <PremiumIcon name={social.name} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
            Quick links
          </p>
          <div className="mt-5 grid gap-3 text-sm text-white/55">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group inline-flex items-center gap-2 w-fit transition-colors hover:text-primary"
              >
                <span className="inline-block h-px w-4 bg-white/20 transition-all duration-300 group-hover:w-6 group-hover:bg-primary" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
            Opening hours
          </p>
          <div className="mt-5 space-y-3 text-sm text-white/60">
            {HOURS.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 backdrop-blur-sm"
              >
                <span>{row.label}</span>
                <span className="font-mono text-xs text-white/80">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">
            Visit us
          </p>
          <div className="mt-5 space-y-3 text-sm text-white/60">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
                <PremiumIcon name="store" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-white/80">Phnom Penh</p>
                <p className="text-xs text-white/45">Cambodia</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
                <PremiumIcon name="phone" className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono text-white/80">+855 12 345 678</p>
                <p className="text-xs text-white/45">Daily support</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-5 text-sm text-white/40 sm:flex-row sm:items-center">
          <p>© 2026 Tisa POS Commerce · All rights reserved</p>
          <div className="flex items-center gap-5 text-xs text-white/35">
            <Link href="/login" className="transition-colors hover:text-white/75">
              Log in ↗
            </Link>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-[pulse-soft_2s_ease-in-out_infinite]" />
              Online
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
