"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSignedInStatusAction } from "@/app/actions/session";
import { useGuestCart } from "@/components/storefront/guest-cart-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { getCartLineLabel } from "@/lib/catalog/drink-sizes";
import { getGuestCartItemLineId } from "@/lib/guest-cart";
import { getProductIconName } from "@/lib/premium-icons";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { items, isHydrated, subtotal, tax, total, taxPercent, updateQty, removeItem } =
    useGuestCart();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getSignedInStatusAction()
      .then((result) => {
        if (!cancelled) {
          setIsSignedIn(result.signedIn);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsSignedIn(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Shopping cart"
        title="Review cart"
        description="Take one last look before checkout, adjust quantities, and keep your favorites ready to go."
      />
      {!isHydrated ? (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            {[0, 1].map((item) => (
              <Card key={item}>
                <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">
                    <div className="h-[88px] w-[88px] rounded-2xl bg-slate-200/70" />
                    <div className="space-y-3">
                      <div className="h-6 w-44 rounded-full bg-slate-200/80" />
                      <div className="h-4 w-24 rounded-full bg-slate-200/60" />
                      <div className="h-4 w-32 rounded-full bg-slate-200/50" />
                    </div>
                  </div>
                  <div className="h-11 w-36 rounded-2xl bg-slate-200/60" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="h-4 w-2/3 rounded-full bg-slate-200/80" />
              <div className="h-4 w-1/2 rounded-full bg-slate-200/70" />
              <div className="h-px bg-black/[0.04]" />
              <div className="h-8 w-full rounded-full bg-slate-200/60" />
            </CardContent>
          </Card>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse the menu and add a few cafe favorites to get started."
          actionHref="/shop"
          actionLabel="Browse Products"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* ── Cart Items ── */}
          <div className="space-y-4">
            {items.map((item, i) => (
              <Card key={getGuestCartItemLineId(item)} className={`animate-in delay-${(i % 4) + 1}`}>
                <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-5">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        width={88}
                        height={88}
                        className="h-[88px] w-[88px] rounded-2xl object-cover shadow-sm ring-1 ring-black/[0.04]"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl bg-gradient-to-br from-[#f0fdf8] to-[#ecfdf5] text-primary shadow-sm ring-1 ring-black/[0.04]">
                        <PremiumIcon
                          name={getProductIconName(item.name, item.category)}
                          className="h-10 w-10"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-serif text-xl font-semibold text-[#0c1712]">
                        {getCartLineLabel(item.name, item.size, item.ice, item.sweet)}
                      </h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                        {item.category}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {formatCurrency(item.price)} per item
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 border-t border-black/[0.04] pt-4 sm:border-t-0 sm:pt-0">
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 rounded-2xl border border-black/[0.06] bg-[#f8faf9] p-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateQty(getGuestCartItemLineId(item), item.quantity - 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm font-semibold text-[#0c1712] shadow-sm hover:text-primary transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <PremiumIcon name="minus" className="h-3 w-3" />
                      </button>
                      <span className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-[#0c1712]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQty(getGuestCartItemLineId(item), item.quantity + 1)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-sm font-semibold text-[#0c1712] shadow-sm hover:text-primary transition-colors"
                        aria-label="Increase quantity"
                      >
                        <PremiumIcon name="plus" className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="min-w-[80px] text-right font-mono text-lg font-semibold text-primary">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(getGuestCartItemLineId(item))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-muted/50 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                      aria-label={`Remove ${getCartLineLabel(item.name, item.size, item.ice, item.sweet)}`}
                    >
                      <PremiumIcon name="close" className="h-5 w-5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Order Summary (sticky) ── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Card className="overflow-hidden border-0 bg-gradient-to-b from-[#f0fdf8] to-white shadow-[0_20px_40px_-12px_rgba(13,148,136,0.15)] ring-1 ring-primary/10 animate-in slide-in-from-right-8">
              <CardHeader className="border-b border-primary/5 bg-white/50 backdrop-blur-sm">
                <CardTitle className="font-serif text-xl">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6 bg-white/50 backdrop-blur-sm">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={getGuestCartItemLineId(item)} className="flex items-start justify-between gap-4">
                      <span className="text-sm leading-snug text-muted">
                        {getCartLineLabel(item.name, item.size, item.ice, item.sweet)}{" "}
                        <span className="font-medium text-[#0c1712]">×{item.quantity}</span>
                      </span>
                      <span className="text-sm font-medium text-[#0c1712]">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-black/[0.04]" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted">Subtotal</span>
                    <span className="text-sm font-medium text-[#0c1712]">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted">Tax ({taxPercent}%)</span>
                    <span className="text-sm font-medium text-[#0c1712]">
                      {formatCurrency(tax)}
                    </span>
                  </div>
                </div>
                <div className="h-px bg-black/[0.04]" />
                <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm ring-1 ring-amber-200/70">
                      <PremiumIcon name="trophy" className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Earn {Math.floor(total)} loyalty points
                      </p>
                      {isSignedIn ? (
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          These points will be added to your rewards account at checkout.
                        </p>
                      ) : (
                        <>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            Sign in before checkout so this order is linked to your rewards account.
                          </p>
                          <Link
                            href="/login?redirectTo=/cart"
                            className="mt-2 inline-flex text-xs font-semibold text-primary hover:underline"
                          >
                            Sign in for rewards
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="h-px bg-black/[0.04]" />
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="font-serif text-lg font-semibold text-[#0c1712]">TOTAL</span>
                    <p className="text-xs text-muted">Including taxes</p>
                  </div>
                  <span className="font-mono text-3xl font-semibold tracking-tight text-primary">
                    {formatCurrency(total)}
                  </span>
                </div>
                <div className="pt-2">
                  <Button asChild fullWidth size="lg" className="h-14 bg-gradient-to-r from-primary to-teal-600 text-white shadow-[0_4px_24px_-8px_rgba(13,148,136,0.5)] hover:shadow-[0_8px_32px_-8px_rgba(13,148,136,0.6)]">
                    <Link href="/checkout" className="flex items-center justify-center gap-2">
                      Proceed to Checkout
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
