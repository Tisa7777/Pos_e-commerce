"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getGuestOrderReceiptAction,
  type GuestOrderResult,
} from "@/app/actions/guest-orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { formatCurrency } from "@/lib/utils";

type OrderData = GuestOrderResult;

export default function OrderConfirmationPage() {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      setIsLoading(true);
      setLoadMessage(null);

      const urlOrderId = new URLSearchParams(window.location.search).get("id");

      try {
        const raw = sessionStorage.getItem("tisa_last_order");
        if (raw) {
          const savedOrder = JSON.parse(raw) as OrderData;

          if (!urlOrderId || savedOrder.orderId === urlOrderId) {
            if (!cancelled) {
              setOrder(savedOrder);
              setIsLoading(false);
            }
            return;
          }
        }
      } catch (error) {
        console.warn("Unable to read saved guest order locally.", error);
      }

      if (!urlOrderId) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      const result = await getGuestOrderReceiptAction(urlOrderId);

      if (cancelled) {
        return;
      }

      if (result.ok && result.data) {
        setOrder(result.data);

        try {
          sessionStorage.setItem("tisa_last_order", JSON.stringify(result.data));
        } catch (error) {
          console.warn("Unable to save loaded guest receipt locally.", error);
        }
      } else {
        setLoadMessage(result.message);
      }

      setIsLoading(false);
    }

    void loadOrder();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <PremiumIcon name="receipt" className="mx-auto h-12 w-12 text-[#0f766e]" />
        <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">
          Loading receipt
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;re finding your order details now.
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <PremiumIcon name="search" className="mx-auto h-12 w-12 text-slate-300" />
        <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-900">
          Order not found
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {loadMessage ?? "We couldn't find your order details. It may have already been viewed."}
        </p>
        <div className="mt-8">
          <Button asChild className="bg-[#0f766e] text-white hover:bg-teal-700">
            <Link href="/shop">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  const paymentIconName = order.paymentMethod === "qr" ? "qr" : "cash";
  const paymentLabel = order.paymentMethod === "qr" ? "QR Payment" : "Cash";
  const deliveryIconName = order.deliveryType === "pickup" ? "store" : "delivery";
  const deliveryLabel =
    order.deliveryType === "pickup"
      ? "Pickup — Tisa Cafe, Phnom Penh"
      : `Delivery — ${order.deliveryAddress || "Address provided"}`;
  const orderNotice =
    order.deliveryType === "pickup"
      ? {
          title: "Your order was sent to the shop.",
          body: "Estimated ready: 15-20 minutes. Track this order to know when it is ready for pickup.",
        }
      : {
          title: "Your order was sent to the shop.",
          body: "We will prepare it now. Track this order to know when delivery is on the way.",
        };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Card className="overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#0f766e,#14b8a6)] px-8 py-10 text-center text-white">
          <PremiumIcon name="check" className="mx-auto h-14 w-14" />
          <h1 className="mt-4 font-serif text-3xl font-semibold">Order Placed!</h1>
          <p className="mt-2 text-lg text-white/85">
            Thank you, {order.guestName?.trim() || "valued customer"}!
          </p>
          <p className="mt-1 font-mono text-sm text-white/70">
            Order {order.orderNumber}
          </p>
        </div>
        <CardContent className="space-y-6 px-8 py-8">
          <div className="rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
            <p className="font-semibold">{orderNotice.title}</p>
            <p className="mt-1 text-teal-800/80">{orderNotice.body}</p>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Items you bought
            </p>
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-600">
                  {item.name} ×{item.quantity}
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </div>
            ))}
            <div className="h-px bg-slate-100" />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Subtotal</span>
              <span className="text-sm font-medium text-slate-700">
                {formatCurrency(order.subtotal)}
              </span>
            </div>
            {(order.discount ?? 0) > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-emerald-600">
                  Coupon{order.couponCode ? ` (${order.couponCode})` : ""}
                </span>
                <span className="text-sm font-medium text-emerald-600">
                  −{formatCurrency(order.discount ?? 0)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Tax (10%)</span>
              <span className="text-sm font-medium text-slate-700">
                {formatCurrency(order.tax)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">
                {order.deliveryType === "delivery" ? "Delivery" : "Pickup"}
              </span>
              <span className="text-sm font-medium text-slate-700">
                {order.deliveryType === "delivery"
                  ? (order.shippingAmount ?? 0) > 0
                    ? formatCurrency(order.shippingAmount ?? 0)
                    : "Free"
                  : "Free"}
              </span>
            </div>
            <div className="h-px bg-slate-100" />
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold text-slate-900">Total paid</span>
              <span className="text-lg font-semibold text-slate-950">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>

          {/* Payment & Delivery */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Payment</span>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <PremiumIcon name={paymentIconName} className="h-4 w-4 text-[#0f766e]" />
                {paymentLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500">Pickup/Delivery</span>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <PremiumIcon name={deliveryIconName} className="h-4 w-4 text-[#0f766e]" />
                {deliveryLabel}
              </span>
            </div>
          </div>

          {order.deliveryType === "pickup" && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <PremiumIcon name="time" className="h-4 w-4" />
              Estimated ready: ~15–20 minutes
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="button"
              fullWidth
              onClick={() => printOrderReceipt(order)}
              className="bg-[#0f766e] text-white hover:bg-teal-700"
            >
              <PremiumIcon name="print" className="h-4 w-4" />
              Print receipt
            </Button>
            <Button
              asChild
              fullWidth
              variant="ghost"
              className="border border-slate-200 bg-white hover:border-[#0f766e]/20 hover:text-[#0f766e]"
            >
              <Link href="/orders" className="inline-flex items-center gap-2">
                <PremiumIcon name="orders" className="h-4 w-4" />
                Track Order
              </Link>
            </Button>
            <Button
              asChild
              fullWidth
              variant="ghost"
              className="border border-slate-200 bg-white hover:border-[#0f766e]/20 hover:text-[#0f766e]"
            >
              <Link href="/shop" className="inline-flex items-center gap-2">
                <PremiumIcon name="cart" className="h-4 w-4" />
                Shop More
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function summaryRow(label: string, value: number) {
  return `<div><span>${escapeHtml(label)}</span><span>${escapeHtml(formatCurrency(value))}</span></div>`;
}

function buildOrderReceiptHtml(order: OrderData) {
  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td class="name">${escapeHtml(item.name)} <span class="qty">x${item.quantity}</span></td>
          <td class="amt">${escapeHtml(formatCurrency(item.price * item.quantity))}</td>
        </tr>`,
    )
    .join("");

  const lines: string[] = [summaryRow("Subtotal", order.subtotal)];
  if ((order.discount ?? 0) > 0) {
    lines.push(summaryRow("Coupon", -(order.discount ?? 0)));
  }
  lines.push(summaryRow("Tax", order.tax));
  if (order.deliveryType === "delivery") {
    lines.push(summaryRow("Delivery", order.shippingAmount ?? 0));
  }

  const methodLabel = order.deliveryType === "delivery" ? "Delivery" : "Pickup";
  const paymentLabel = order.paymentMethod === "qr" ? "QR" : "Cash";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${escapeHtml(order.orderNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: "Courier New", ui-monospace, monospace; color: #0c1712; margin: 0; padding: 24px; background: #fff; }
      .receipt { max-width: 320px; margin: 0 auto; }
      .brand { text-align: center; margin-bottom: 16px; }
      .brand h1 { font-size: 20px; margin: 0; letter-spacing: 2px; }
      .brand p { margin: 4px 0 0; font-size: 11px; color: #475569; }
      .meta { font-size: 12px; margin: 12px 0; }
      .meta div { display: flex; justify-content: space-between; margin: 2px 0; }
      .divider { border-top: 1px dashed #94a3b8; margin: 12px 0; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      td { padding: 3px 0; vertical-align: top; }
      td.amt { text-align: right; white-space: nowrap; padding-left: 10px; }
      .qty { color: #64748b; }
      .summary { font-size: 12px; margin-top: 8px; }
      .summary div { display: flex; justify-content: space-between; margin: 2px 0; color: #475569; }
      .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 8px; }
      .footer { text-align: center; font-size: 11px; color: #475569; margin-top: 18px; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="brand">
        <h1>TISA CAFE</h1>
        <p>Phnom Penh • Thank you, ${escapeHtml(order.guestName)}</p>
      </div>
      <div class="divider"></div>
      <div class="meta">
        <div><span>Order</span><span>${escapeHtml(order.orderNumber)}</span></div>
        <div><span>Date</span><span>${escapeHtml(new Date(order.createdAt).toLocaleString())}</span></div>
        <div><span>Method</span><span>${escapeHtml(methodLabel)}</span></div>
        <div><span>Payment</span><span>${escapeHtml(paymentLabel)}</span></div>
      </div>
      <div class="divider"></div>
      <table><tbody>${itemRows}</tbody></table>
      <div class="divider"></div>
      <div class="summary">${lines.join("")}</div>
      <div class="total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(order.total))}</span></div>
      <div class="footer"><p>Keep this receipt for your records.</p></div>
    </div>
  </body>
</html>`;
}

function printOrderReceipt(order: OrderData) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(buildOrderReceiptHtml(order));
  doc.close();

  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      document.body.removeChild(iframe);
    }, 500);
  }, 250);
}
