"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { trackGuestOrderAction } from "@/app/actions/guest-orders";
import { PremiumIcon } from "@/components/ui/premium-icon";
import {
  getGuestOrderSummaries,
  type GuestOrderSummary,
} from "@/lib/guest-cart";
import { cn, formatCurrency } from "@/lib/utils";
import type { PublicOrderTracking } from "@/types/domain";

function getFallbackSummary() {
  try {
    const raw = sessionStorage.getItem("tisa_last_order");
    return raw ? (JSON.parse(raw) as GuestOrderSummary) : null;
  } catch {
    return null;
  }
}

function getLatestOrderSummary() {
  const summaries = getGuestOrderSummaries();
  return summaries[0] ?? getFallbackSummary();
}

function getNotificationTone(order: PublicOrderTracking | null) {
  if (!order) {
    return "pending";
  }

  if (order.status === "completed") {
    return "ready";
  }

  if (order.status === "cancelled") {
    return "cancelled";
  }

  return "pending";
}

export function OrderNotificationButton() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [latestOrder, setLatestOrder] = useState<GuestOrderSummary | null>(null);
  const [tracking, setTracking] = useState<PublicOrderTracking | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasOrder = Boolean(latestOrder);
  const tone = getNotificationTone(tracking);
  const hasNewUpdate = tracking
    ? tracking.status === "completed" || tracking.status === "processing"
    : hasOrder;

  async function refreshLatestOrder() {
    const summary = getLatestOrderSummary();
    setLatestOrder(summary);

    if (!summary?.orderNumber) {
      setTracking(null);
      return;
    }

    setIsRefreshing(true);
    try {
      const result = await trackGuestOrderAction({ orderNumber: summary.orderNumber });
      setTracking(result.ok && result.data ? result.data : null);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshLatestOrder();

    const handleOrdersChanged = () => {
      void refreshLatestOrder();
    };
    const interval = window.setInterval(() => {
      void refreshLatestOrder();
    }, 30000);

    window.addEventListener("tisa:orders-changed", handleOrdersChanged);
    window.addEventListener("focus", handleOrdersChanged);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("tisa:orders-changed", handleOrdersChanged);
      window.removeEventListener("focus", handleOrdersChanged);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const message =
    tracking?.customerMessage ??
    (latestOrder
      ? "Your order was sent to the shop. Track it for pickup or delivery updates."
      : "Order updates will appear here after checkout.");

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Order notifications"
        onClick={() => {
          setIsOpen((value) => !value);
          void refreshLatestOrder();
        }}
        className={cn(
          "relative inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white text-muted shadow-sm transition-all hover:border-primary/20 hover:text-primary hover:shadow-[0_4px_12px_-4px_rgba(13,148,136,0.15)]",
          hasNewUpdate ? "border-teal-200" : "border-black/[0.06]",
        )}
      >
        <PremiumIcon name="bell" className="h-5 w-5" />
        {hasNewUpdate ? (
          <span
            className={cn(
              "absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white",
              tone === "ready"
                ? "bg-emerald-500"
                : tone === "cancelled"
                  ? "bg-rose-500"
                  : "bg-amber-500",
            )}
          />
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-[0_22px_70px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-700">
                Notifications
              </p>
              <h3 className="mt-1 font-serif text-lg font-semibold text-slate-950">
                Order updates
              </h3>
            </div>
            {isRefreshing ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                Refreshing
              </span>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            {latestOrder ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs font-semibold text-slate-500">
                    {latestOrder.orderNumber}
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                    {tracking?.status ?? "placed"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">
                  {message}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>
                    {latestOrder.deliveryType === "delivery" ? "Delivery" : "Pickup"}
                  </span>
                  <span className="font-mono">
                    {formatCurrency(latestOrder.total)}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">{message}</p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              href="/orders"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              Track order
            </Link>
            <button
              type="button"
              onClick={() => void refreshLatestOrder()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
