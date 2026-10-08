"use client";

import Link from "next/link";
import { useGuestCart } from "@/components/storefront/guest-cart-provider";
import { OrderNotificationButton } from "@/components/storefront/order-notification-button";
import { ProfileMenu } from "@/components/storefront/profile-menu";
import { Button } from "@/components/ui/button";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { STOREFRONT_NAV } from "@/lib/auth/constants";

export interface StorefrontHeaderAccount {
  name: string;
  email: string;
  loyaltyPoints: number | null;
}

export function StorefrontHeader({ account }: { account?: StorefrontHeaderAccount | null }) {
  const { cartCount, isHydrated } = useGuestCart();

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-2xl backdrop-saturate-[1.8]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 lg:gap-5">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-teal-600 px-2.5 py-1.5 sm:px-3 sm:py-2 font-mono text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.24em] text-white shadow-[0_4px_16px_-4px_rgba(13,148,136,0.5)] transition-all duration-300 group-hover:shadow-[0_8px_24px_-6px_rgba(13,148,136,0.6)] group-hover:scale-105">
              Coffee
            </div>
            <p className="font-serif text-lg sm:text-xl font-semibold text-[#0c1712] hidden sm:block">Coffee Shop</p>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-muted md:flex">
            {STOREFRONT_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative py-1 transition-colors hover:text-primary after:absolute after:-bottom-0.5 after:left-0 after:h-[2px] after:w-0 after:bg-gradient-to-r after:from-primary after:to-teal-500 after:transition-all after:duration-300 hover:after:w-full"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="View receipts"
            className="rounded-full border border-black/[0.06] bg-white text-muted shadow-sm hover:border-primary/20 hover:text-primary hover:shadow-[0_4px_12px_-4px_rgba(13,148,136,0.15)]"
          >
            <Link href="/orders">
              <PremiumIcon name="receipt" className="h-5 w-5" />
            </Link>
          </Button>
          <OrderNotificationButton />
          <Link
            href="/cart"
            className="inline-flex h-10 sm:h-11 items-center gap-1.5 sm:gap-2 rounded-full border border-black/[0.06] bg-white px-3 sm:px-4 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/20 hover:text-primary hover:shadow-[0_4px_12px_-4px_rgba(13,148,136,0.15)] hover:-translate-y-0.5"
          >
            <PremiumIcon name="cart" className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            <span
              className={`inline-flex min-w-5 sm:min-w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-white shadow-[0_2px_8px_-2px_rgba(13,148,136,0.5)] transition-opacity duration-300 ${isHydrated ? "opacity-100" : "opacity-0"}`}
            >
              {cartCount}
            </span>
          </Link>
          {account ? (
            <ProfileMenu
              name={account.name}
              email={account.email}
              loyaltyPoints={account.loyaltyPoints}
            />
          ) : (
            <Link
              href="/login"
              className="hidden text-[13px] text-muted/60 transition hover:text-muted hover:underline lg:inline"
            >
              Sign in ↗
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
