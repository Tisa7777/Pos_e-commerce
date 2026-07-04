"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { trackGuestOrderAction } from "@/app/actions/guest-orders";
import { listMyOrdersAction } from "@/app/actions/my-orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIcon } from "@/components/ui/premium-icon";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { formatCurrency } from "@/lib/utils";
import type { ActionState, OrderDetail, PublicOrderTracking } from "@/types/domain";

export default function OrdersPage() {
  const [myOrders, setMyOrders] = useState<OrderDetail[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [trackInput, setTrackInput] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<PublicOrderTracking | null>(null);
  const [trackingState, setTrackingState] = useState<ActionState<PublicOrderTracking>>({
    ok: false,
    message: "",
  });
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listMyOrdersAction()
      .then((orders) => {
        if (!cancelled) {
          setMyOrders(orders);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMyOrders([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMine(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTrackOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const orderNumber = trackInput.trim();
    if (!orderNumber) {
      setTrackedOrder(null);
      setTrackingState({
        ok: false,
        message: "Enter an order number to track.",
      });
      return;
    }

    setIsTracking(true);
    setTrackingState({ ok: false, message: "" });

    try {
      const result = await trackGuestOrderAction({ orderNumber });
      setTrackingState(result);
      setTrackedOrder(result.ok && result.data ? result.data : null);
    } catch {
      setTrackedOrder(null);
      setTrackingState({
        ok: false,
        message: "Unable to track this order right now.",
      });
    } finally {
      setIsTracking(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Order history"
        title="Your orders"
        description="View your recent cafe orders and print a receipt anytime."
      />

      {/* Signed-in customer orders */}
      {myOrders.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Your receipts</h3>
          {myOrders.map((order) => (
            <OrderReceiptCard key={order.id} order={order} />
          ))}
        </div>
      ) : null}

      {/* Track Order */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-slate-900">Track an order</h3>
          <p className="mt-1 text-sm text-slate-500">
            Enter an order number to check its status and print the receipt.
          </p>
          <form onSubmit={handleTrackOrder} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              aria-invalid={Boolean(trackingState.fieldErrors?.orderNumber)}
              placeholder="ORD-20260327-12345"
              className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:border-[#0f766e] focus:outline-none focus:ring-1 focus:ring-[#0f766e]"
            />
            <Button
              type="submit"
              disabled={isTracking}
              className="bg-[#0f766e] text-white hover:bg-teal-700"
            >
              {isTracking ? "Tracking..." : "Track Order"}
            </Button>
          </form>
          {trackingState.message ? (
            <p
              className={`mt-3 text-sm font-medium ${
                trackingState.ok ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {trackingState.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {trackedOrder ? <TrackedOrderCard order={trackedOrder} /> : null}

      {/* Empty state */}
      {!loadingMine && myOrders.length === 0 && !trackedOrder ? (
        <div className="py-10 text-center">
          <PremiumIcon name="receipt" className="mx-auto h-11 w-11 text-slate-300" />
          <p className="mt-4 font-serif text-xl font-semibold text-slate-900">No orders yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Place an order or track one by number to see your receipt here.
          </p>
          <div className="mt-6">
            <Button asChild className="bg-[#0f766e] text-white hover:bg-teal-700">
              <Link href="/shop">Start Shopping</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrderReceiptCard({ order }: { order: OrderDetail }) {
  const fulfillmentType = getFulfillmentType(order.notes);

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-mono text-lg font-semibold text-slate-950">{order.orderNumber}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Badge tone={order.paymentStatus === "paid" ? "success" : "warning"}>
              {order.paymentStatus.replaceAll("_", " ")}
            </Badge>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4">
              <span className="min-w-0 truncate text-sm text-slate-600">
                {item.productName} x{item.quantity}
              </span>
              <span className="font-mono text-sm font-medium text-slate-800">
                {formatCurrency(item.lineTotal)}
              </span>
            </div>
          ))}
          <ReceiptTotals order={order} />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => printReceipt(orderDetailToReceipt(order, fulfillmentType))}
            className="bg-[#0f766e] text-white hover:bg-teal-700"
          >
            <PremiumIcon name="print" className="h-4 w-4" />
            Print receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptTotals({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
      <TotalRow label="Subtotal" value={order.subtotalAmount} />
      {order.discountAmount > 0 ? (
        <TotalRow label="Discount" value={-order.discountAmount} />
      ) : null}
      {order.taxAmount > 0 ? <TotalRow label="Tax" value={order.taxAmount} /> : null}
      {order.shippingAmount > 0 ? <TotalRow label="Delivery" value={order.shippingAmount} /> : null}
      <div className="flex items-center justify-between gap-4 pt-1">
        <span className="font-semibold text-slate-900">Total</span>
        <span className="font-mono font-semibold text-slate-900">
          {formatCurrency(order.totalAmount)}
        </span>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-slate-500">
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );
}

function TrackedOrderCard({ order }: { order: PublicOrderTracking }) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
              Tracking result
            </p>
            <h3 className="mt-2 font-mono text-lg font-semibold text-slate-950">
              {order.orderNumber}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Badge tone={order.paymentStatus === "paid" ? "success" : "warning"}>
              {order.paymentStatus.replaceAll("_", " ")}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <TrackingStat label="Channel" value={order.channel === "pos" ? "POS" : "Online"} />
          <TrackingStat
            label="Method"
            value={order.fulfillmentType === "delivery" ? "Delivery" : "Pickup"}
          />
          <TrackingStat label="Items" value={String(order.itemCount)} />
          <TrackingStat label="Total" value={formatCurrency(order.totalAmount)} />
        </div>

        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            order.status === "completed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : order.status === "cancelled"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-semibold">{order.customerMessage}</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
          {order.items.map((item, index) => (
            <div key={`${item.productName}-${index}`} className="flex items-center justify-between gap-4">
              <span className="min-w-0 truncate text-sm text-slate-600">
                {item.productName} x{item.quantity}
              </span>
              <span className="font-mono text-sm font-medium text-slate-800">
                {formatCurrency(item.lineTotal)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
            <span className="text-sm font-semibold text-slate-900">Total</span>
            <span className="font-mono text-sm font-semibold text-slate-900">
              {formatCurrency(order.totalAmount)}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => printReceipt(trackingToReceipt(order))}
            className="bg-[#0f766e] text-white hover:bg-teal-700"
          >
            <PremiumIcon name="print" className="h-4 w-4" />
            Print receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TrackingStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

// ── Receipt printing ───────────────────────────────────────────────

interface ReceiptInput {
  orderNumber: string;
  createdAt: string;
  channel: string;
  paymentStatus: string;
  fulfillmentType: "pickup" | "delivery";
  items: Array<{ productName: string; quantity: number; lineTotal: number }>;
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  shipping?: number | null;
  total: number;
}

function getFulfillmentType(notes?: string | null): "pickup" | "delivery" {
  return notes?.toLowerCase().includes("delivery to:") ? "delivery" : "pickup";
}

function orderDetailToReceipt(
  order: OrderDetail,
  fulfillmentType: "pickup" | "delivery",
): ReceiptInput {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    channel: order.channel,
    paymentStatus: order.paymentStatus,
    fulfillmentType,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotalAmount,
    discount: order.discountAmount,
    tax: order.taxAmount,
    shipping: order.shippingAmount,
    total: order.totalAmount,
  };
}

function trackingToReceipt(order: PublicOrderTracking): ReceiptInput {
  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    channel: order.channel,
    paymentStatus: order.paymentStatus,
    fulfillmentType: order.fulfillmentType,
    items: order.items,
    total: order.totalAmount,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReceiptHtml(receipt: ReceiptInput) {
  const itemRows = receipt.items
    .map(
      (item) => `
        <tr>
          <td class="name">${escapeHtml(item.productName)} <span class="qty">x${item.quantity}</span></td>
          <td class="amt">${escapeHtml(formatCurrency(item.lineTotal))}</td>
        </tr>`,
    )
    .join("");

  const totalLines: string[] = [];
  if (typeof receipt.subtotal === "number") {
    totalLines.push(summaryRow("Subtotal", receipt.subtotal));
  }
  if (typeof receipt.discount === "number" && receipt.discount > 0) {
    totalLines.push(summaryRow("Discount", -receipt.discount));
  }
  if (typeof receipt.tax === "number" && receipt.tax > 0) {
    totalLines.push(summaryRow("Tax", receipt.tax));
  }
  if (typeof receipt.shipping === "number" && receipt.shipping > 0) {
    totalLines.push(summaryRow("Delivery", receipt.shipping));
  }

  const methodLabel = receipt.fulfillmentType === "delivery" ? "Delivery" : "Pickup";
  const channelLabel = receipt.channel === "pos" ? "POS" : "Online";
  const paymentLabel = receipt.paymentStatus.replaceAll("_", " ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${escapeHtml(receipt.orderNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: "Courier New", ui-monospace, monospace;
        color: #0c1712;
        margin: 0;
        padding: 24px;
        background: #fff;
      }
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
        <p>Phnom Penh • Thank you for your order</p>
      </div>
      <div class="divider"></div>
      <div class="meta">
        <div><span>Order</span><span>${escapeHtml(receipt.orderNumber)}</span></div>
        <div><span>Date</span><span>${escapeHtml(new Date(receipt.createdAt).toLocaleString())}</span></div>
        <div><span>Channel</span><span>${escapeHtml(channelLabel)}</span></div>
        <div><span>Method</span><span>${escapeHtml(methodLabel)}</span></div>
        <div><span>Payment</span><span>${escapeHtml(paymentLabel)}</span></div>
      </div>
      <div class="divider"></div>
      <table><tbody>${itemRows}</tbody></table>
      <div class="divider"></div>
      <div class="summary">${totalLines.join("")}</div>
      <div class="total">
        <span>TOTAL</span>
        <span>${escapeHtml(formatCurrency(receipt.total))}</span>
      </div>
      <div class="footer"><p>Keep this receipt for your records.</p></div>
    </div>
  </body>
</html>`;
}

function summaryRow(label: string, value: number) {
  return `<div><span>${escapeHtml(label)}</span><span>${escapeHtml(formatCurrency(value))}</span></div>`;
}

function printReceipt(receipt: ReceiptInput) {
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
  doc.write(buildReceiptHtml(receipt));
  doc.close();

  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => {
      document.body.removeChild(iframe);
    }, 500);
  }, 250);
}
