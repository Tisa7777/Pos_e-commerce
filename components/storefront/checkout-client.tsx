"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGuestCart } from "@/components/storefront/guest-cart-provider";
import { placeGuestOrderAction } from "@/app/actions/guest-orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIcon } from "@/components/ui/premium-icon";
import {
  calculateDeliveryFee,
  FREE_DELIVERY_MINIMUM,
  getAmountUntilFreeDelivery,
} from "@/lib/checkout/delivery";
import { getCartLineLabel } from "@/lib/catalog/drink-sizes";
import {
  getGuestCartItemLineId,
  saveGuestOrderId,
  saveGuestOrderSummary,
} from "@/lib/guest-cart";
import { getProductIconName } from "@/lib/premium-icons";
import { formatCurrency, formatDate } from "@/lib/utils";

type DeliveryType = "pickup" | "delivery";
type PaymentMethod = "cash" | "qr";

export interface CheckoutAccount {
  name: string;
  email: string;
  phone: string;
}

export interface CheckoutCoupon {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt: string | null;
}

export function CheckoutClient({
  account,
  coupons = [],
}: {
  account: CheckoutAccount | null;
  coupons?: CheckoutCoupon[];
}) {
  const router = useRouter();
  const { items, isHydrated, subtotal, tax, clear } = useGuestCart();

  const isAuthenticated = Boolean(account);
  const [guestName, setGuestName] = useState(account?.name ?? "");
  const [guestPhone, setGuestPhone] = useState(account?.phone ?? "");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedCouponCode, setSelectedCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const deliveryFee = calculateDeliveryFee(deliveryType, subtotal);
  const selectedCoupon = coupons.find((coupon) => coupon.code === selectedCouponCode) ?? null;
  const couponDiscount = selectedCoupon
    ? Math.min(Math.round(subtotal * (selectedCoupon.discountPercent / 100) * 100) / 100, subtotal)
    : 0;
  const total = Math.round((subtotal - couponDiscount + tax + deliveryFee) * 100) / 100;
  const amountUntilFreeDelivery = getAmountUntilFreeDelivery(subtotal);
  const deliveryFeeLabel =
    deliveryType === "delivery" && deliveryFee === 0
      ? `Free delivery unlocked for orders ${formatCurrency(FREE_DELIVERY_MINIMUM)} or more.`
      : `Delivery is free for orders ${formatCurrency(FREE_DELIVERY_MINIMUM)} or more.`;

  const headerDescription = isAuthenticated
    ? "Confirm your phone number and where you want your order. Loyalty points are added to your account."
    : "Fill in your details and confirm your order. Sign in first if you want loyalty points.";

  if (!isHydrated) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <PageHeader
          eyebrow="Checkout"
          title="Complete your order"
          description={headerDescription}
        />
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="order-2 overflow-hidden lg:order-1">
            <CardHeader>
              <CardTitle>Your order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="h-4 w-2/3 rounded-full bg-slate-200/80" />
              <div className="h-4 w-1/2 rounded-full bg-slate-200/70" />
              <div className="h-px bg-black/[0.04]" />
              <div className="h-8 w-full rounded-full bg-slate-200/60" />
            </CardContent>
          </Card>
          <div className="order-1 space-y-6 lg:order-2">
            {["Your Details", "Pickup or Delivery?", "Payment Method"].map((title) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-11 rounded-2xl bg-slate-200/70" />
                  <div className="h-11 rounded-2xl bg-slate-200/50" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <EmptyState
          title="Checkout starts from the cart"
          description="Add a few products first, then come back here to place an order."
          actionHref="/shop"
          actionLabel="Go to shop"
        />
      </div>
    );
  }

  async function handlePlaceOrder() {
    setError(null);
    setFieldErrors({});

    if (!guestPhone.trim()) {
      setFieldErrors({ guestPhone: ["Phone number is required."] });
      setError("Please add your phone number.");
      return;
    }

    if (!deliveryAddress.trim()) {
      setFieldErrors({ deliveryAddress: ["Address / location is required."] });
      setError("Please add your address or location.");
      return;
    }

    if (paymentMethod === "qr" && !qrConfirmed) {
      setError("Please confirm that you have completed the QR payment.");
      return;
    }

    setIsSubmitting(true);

    // For pickup orders, keep the customer location in the notes so staff can
    // still reach them (the delivery address line is only used for delivery).
    const composedNotes =
      deliveryType === "pickup" && deliveryAddress.trim()
        ? [`Location: ${deliveryAddress.trim()}`, notes.trim()].filter(Boolean).join(" | ")
        : notes;

    try {
      const result = await placeGuestOrderAction({
        guestName: guestName || account?.name || "",
        guestPhone,
        guestEmail: "",
        deliveryType,
        deliveryAddress: deliveryAddress || "",
        couponCode: isAuthenticated ? selectedCouponCode.trim() : "",
        paymentMethod,
        notes: composedNotes || "",
        items: items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          size: item.size ?? null,
          ice: item.ice ?? null,
          sweet: item.sweet ?? null,
          quantity: item.quantity,
        })),
      });

      if (!result.ok) {
        setError(result.message);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setIsSubmitting(false);
        return;
      }

      if (!result.data) {
        setError("Your order was placed, but the receipt details were missing. Please track your order.");
        setIsSubmitting(false);
        return;
      }

      // Save order for tracking & clear cart
      try {
        saveGuestOrderId(result.data.orderId);
        saveGuestOrderSummary({
          orderId: result.data.orderId,
          orderNumber: result.data.orderNumber,
          guestName: result.data.guestName,
          total: result.data.total,
          deliveryType,
          createdAt: result.data.createdAt,
        });
        // Store order data in sessionStorage for confirmation page
        sessionStorage.setItem("tisa_last_order", JSON.stringify(result.data));
      } catch (storageError) {
        console.warn("Unable to save guest order locally.", storageError);
      }

      // Navigate to the receipt FIRST. Clearing the cart triggers a re-render
      // to the empty-cart state, which would otherwise interrupt this redirect,
      // leaving the customer stuck on an empty checkout instead of the receipt.
      router.push(`/order-confirmation?id=${result.data.orderId}`);

      // Clear the cart after navigation has started. The cart provider lives in
      // the storefront layout, so this still updates the header count.
      window.setTimeout(() => {
        try {
          clear();
        } catch (storageError) {
          console.warn("Unable to clear guest cart locally.", storageError);
        }
      }, 0);
    } catch {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Checkout"
        title="Complete your order"
        description={headerDescription}
      />
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        {/* ── Left: Order Summary ── */}
        <div className="order-2 lg:order-1">
          <Card className="sticky top-28 overflow-hidden border-0 bg-gradient-to-b from-[#f0fdf8] to-white shadow-[0_20px_40px_-12px_rgba(13,148,136,0.1)] ring-1 ring-primary/10">
            <CardHeader className="border-b border-primary/5 bg-white/50 backdrop-blur-sm">
              <CardTitle className="font-serif text-xl">Your order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6 bg-white/50 backdrop-blur-sm">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={getGuestCartItemLineId(item)} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-black/[0.04]">
                        <PremiumIcon
                          name={getProductIconName(item.name, item.category)}
                          className="h-4 w-4"
                        />
                      </div>
                      <span className="text-sm leading-snug text-[#0c1712]">
                        {getCartLineLabel(item.name, item.size, item.ice, item.sweet)}{" "}
                        <span className="font-medium text-muted">×{item.quantity}</span>
                      </span>
                    </div>
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
                  <span className="text-sm font-medium text-[#0c1712]">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted">Tax (10%)</span>
                  <span className="text-sm font-medium text-[#0c1712]">{formatCurrency(tax)}</span>
                </div>
                {couponDiscount > 0 && selectedCoupon ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-primary">
                      Coupon ({selectedCoupon.discountPercent}% off)
                    </span>
                    <span className="text-sm font-medium text-primary">
                      −{formatCurrency(couponDiscount)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm text-muted">
                    {deliveryType === "delivery" ? "Delivery" : "Pickup"}
                    <span className="mt-1 block text-xs text-muted/70">
                      {deliveryType === "pickup" ? "Pickup in store" : deliveryFeeLabel}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-[#0c1712]">
                    {deliveryType === "delivery" && deliveryFee > 0
                      ? formatCurrency(deliveryFee)
                      : "Free"}
                  </span>
                </div>
              </div>
              <div className="h-px bg-black/[0.04]" />
              <div className="flex items-end justify-between gap-4">
                <span className="font-serif text-lg font-semibold text-[#0c1712]">TOTAL</span>
                <span className="font-mono text-3xl font-semibold tracking-tight text-primary">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Details Form ── */}
        <div className="order-1 space-y-6 lg:order-2">
          {/* YOUR DETAILS */}
          <Card className="animate-in delay-1">
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {isAuthenticated && (
                <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600 text-xs font-semibold text-white">
                    {(account?.name ?? "U").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0c1712]">
                      {account?.name}
                    </p>
                    <p className="truncate text-xs text-muted">Ordering as signed-in member</p>
                  </div>
                </div>
              )}

              {!isAuthenticated && (
                <div className="space-y-2">
                  <label htmlFor="guestName" className="text-sm font-medium text-[#0c1712]">
                    Full name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your full name"
                    className="h-12 w-full rounded-2xl border border-black/[0.08] bg-[#f8faf9] px-4 text-sm shadow-sm transition-all focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/8 focus:shadow-[0_0_0_1px_rgba(13,148,136,0.1)]"
                  />
                  {fieldErrors.guestName && (
                    <p className="text-xs text-rose-500">{fieldErrors.guestName[0]}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="guestPhone" className="text-sm font-medium text-[#0c1712]">
                  Phone number <span className="text-rose-500">*</span>
                </label>
                <input
                  id="guestPhone"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+855 12 345 678"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-[#f8faf9] px-4 text-sm shadow-sm transition-all focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/8 focus:shadow-[0_0_0_1px_rgba(13,148,136,0.1)]"
                />
                {fieldErrors.guestPhone && (
                  <p className="text-xs text-rose-500">{fieldErrors.guestPhone[0]}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="deliveryAddress" className="text-sm font-medium text-[#0c1712]">
                  Address / Location <span className="text-rose-500">*</span>
                </label>
                <input
                  id="deliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House #, street, area / Google Maps link"
                  className="h-12 w-full rounded-2xl border border-black/[0.08] bg-[#f8faf9] px-4 text-sm shadow-sm transition-all focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/8 focus:shadow-[0_0_0_1px_rgba(13,148,136,0.1)]"
                />
                {fieldErrors.deliveryAddress && (
                  <p className="text-xs text-rose-500">{fieldErrors.deliveryAddress[0]}</p>
                )}
                <p className="text-xs text-muted/70">
                  Where we deliver, or your contact location for pickup orders.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* PICKUP OR DELIVERY */}
          <Card className="animate-in delay-2">
            <CardHeader>
              <CardTitle>Pickup or Delivery?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryType("pickup")}
                  className={`flex h-14 items-center justify-center gap-2.5 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    deliveryType === "pickup"
                      ? "border-primary bg-primary/5 text-primary shadow-[0_2px_12px_-4px_rgba(13,148,136,0.2)]"
                      : "border-black/[0.06] text-muted hover:border-black/[0.12] hover:bg-black/[0.01]"
                  }`}
                >
                  <PremiumIcon name="store" className="h-4 w-4" />
                  Pickup in store
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("delivery")}
                  className={`flex h-14 items-center justify-center gap-2.5 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    deliveryType === "delivery"
                      ? "border-primary bg-primary/5 text-primary shadow-[0_2px_12px_-4px_rgba(13,148,136,0.2)]"
                      : "border-black/[0.06] text-muted hover:border-black/[0.12] hover:bg-black/[0.01]"
                  }`}
                >
                  <PremiumIcon name="delivery" className="h-4 w-4" />
                  Delivery
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl bg-slate-50 transition-all">
                {deliveryType === "pickup" ? (
                  <div className="px-5 py-4 text-sm text-muted animate-in fade-in">
                    <p className="font-semibold text-[#0c1712]">Ready at Tisa Cafe, Phnom Penh</p>
                    <p className="mt-1">Estimated time: ~15–20 minutes</p>
                    <p className="mt-2 text-xs font-medium text-primary">
                      Pickup has no delivery charge.
                    </p>
                  </div>
                ) : (
                  <div className="p-5 animate-in fade-in">
                    <div className="rounded-xl border border-teal-100 bg-white px-4 py-3 text-sm text-muted">
                      {deliveryFee === 0 ? (
                        <p>
                          <span className="font-semibold text-primary">Free delivery</span> because your
                          order is at least {formatCurrency(FREE_DELIVERY_MINIMUM)}.
                        </p>
                      ) : (
                        <p>
                          Delivery fee is{" "}
                          <span className="font-mono font-semibold text-[#0c1712]">
                            {formatCurrency(deliveryFee)}
                          </span>
                          . Add {formatCurrency(amountUntilFreeDelivery)} more for free delivery.
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted/70">
                        We&apos;ll deliver to the address you entered above.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* LOYALTY COUPON (signed-in only) */}
          {isAuthenticated && (
            <Card className="animate-in delay-2">
              <CardHeader>
                <CardTitle>Loyalty Coupon</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {coupons.length === 0 ? (
                  <p className="text-sm text-muted/80">
                    You have no coupons yet. Convert your points into a coupon in your{" "}
                    <Link href="/account" className="font-medium text-primary hover:underline">
                      account
                    </Link>
                    .
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-[#0c1712]">
                      Choose a coupon to apply
                    </p>
                    <div className="space-y-2">
                      {coupons.map((coupon) => {
                        const selected = selectedCouponCode === coupon.code;
                        return (
                          <button
                            type="button"
                            key={coupon.id}
                            onClick={() =>
                              setSelectedCouponCode(selected ? "" : coupon.code)
                            }
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                              selected
                                ? "border-primary bg-primary/5 shadow-[0_2px_12px_-4px_rgba(13,148,136,0.2)]"
                                : "border-black/[0.06] hover:border-black/[0.12] hover:bg-black/[0.01]"
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-black/[0.04]">
                                <PremiumIcon name="trophy" className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-[#0c1712]">
                                  {coupon.discountPercent}% off
                                </span>
                                <span className="block text-xs text-muted/70">
                                  {coupon.expiresAt
                                    ? `Expires ${formatDate(coupon.expiresAt)}`
                                    : "No expiry"}
                                </span>
                              </span>
                            </span>
                            {selected ? (
                              <PremiumIcon name="check" className="h-5 w-5 text-primary" />
                            ) : (
                              <span className="text-xs font-semibold text-primary">Apply</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedCouponCode ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCouponCode("")}
                        className="text-xs font-medium text-muted hover:text-rose-500 hover:underline"
                      >
                        Remove coupon
                      </button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* PAYMENT METHOD */}
          <Card className="animate-in delay-3">
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("cash");
                    setQrConfirmed(false);
                  }}
                  className={`flex h-14 items-center justify-center gap-2.5 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    paymentMethod === "cash"
                      ? "border-primary bg-primary/5 text-primary shadow-[0_2px_12px_-4px_rgba(13,148,136,0.2)]"
                      : "border-black/[0.06] text-muted hover:border-black/[0.12] hover:bg-black/[0.01]"
                  }`}
                >
                  <PremiumIcon name="cash" className="h-4 w-4" />
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("qr")}
                  className={`flex h-14 items-center justify-center gap-2.5 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    paymentMethod === "qr"
                      ? "border-primary bg-primary/5 text-primary shadow-[0_2px_12px_-4px_rgba(13,148,136,0.2)]"
                      : "border-black/[0.06] text-muted hover:border-black/[0.12] hover:bg-black/[0.01]"
                  }`}
                >
                  <PremiumIcon name="qr" className="h-4 w-4" />
                  QR Code
                </button>
              </div>

              {paymentMethod === "qr" && (
                <div className="space-y-4 rounded-2xl border border-black/[0.06] bg-[#f8faf9] p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-center">
                    <div className="flex h-44 w-44 flex-col items-center justify-center rounded-[1.5rem] bg-white border border-black/[0.06] shadow-sm text-center text-sm text-muted">
                      <PremiumIcon name="qr" className="h-12 w-12 text-primary" />
                      <p className="mt-3 font-semibold text-[#0c1712]">Scan to pay</p>
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted">
                    Scan and pay <span className="font-mono font-semibold text-primary">{formatCurrency(total)}</span> then check the box below
                  </p>
                  <label className="flex items-center justify-center gap-3 rounded-xl border border-black/[0.06] bg-white p-3 text-sm font-medium text-[#0c1712] shadow-sm cursor-pointer hover:border-primary/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={qrConfirmed}
                      onChange={(e) => setQrConfirmed(e.target.checked)}
                      className="h-5 w-5 rounded-md border-slate-300 text-primary focus:ring-primary"
                    />
                    <span>I have completed the payment</span>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NOTES */}
          <Card className="animate-in delay-4">
            <CardHeader>
              <CardTitle>Order Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or instructions?"
                rows={3}
                className="w-full rounded-2xl border border-black/[0.08] bg-[#f8faf9] px-4 py-3 text-sm shadow-sm transition-all focus:border-primary/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/8 focus:shadow-[0_0_0_1px_rgba(13,148,136,0.1)]"
              />
            </CardContent>
          </Card>

          {/* ERROR */}
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200/50 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 animate-in fade-in slide-in-from-top-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="leading-5">{error}</p>
            </div>
          )}

          {/* PLACE ORDER BUTTON */}
          <div className="pt-2">
            <Button
              type="button"
              fullWidth
              size="lg"
              disabled={isSubmitting}
              onClick={handlePlaceOrder}
              className="h-[3.5rem] bg-gradient-to-r from-primary to-teal-600 text-[15px] shadow-[0_4px_24px_-8px_rgba(13,148,136,0.5)] hover:shadow-[0_8px_32px_-8px_rgba(13,148,136,0.6)] hover:brightness-110"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Placing order...
                </span>
              ) : (
                <>
                  <PremiumIcon name="check" className="h-5 w-5" />
                  Place Order — {formatCurrency(total)}
                </>
              )}
            </Button>
            <p className="mt-4 text-center text-xs font-medium text-muted/60">
              {isAuthenticated
                ? "Signed in · Order linked to your account for loyalty points"
                : "No account needed · Order tracked securely by phone"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
