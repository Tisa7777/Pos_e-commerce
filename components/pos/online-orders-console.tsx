import { updateOnlineOrderStatusAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { OrderDetail, OrderStatus } from "@/types/domain";

const ACTIVE_STATUSES: OrderStatus[] = ["pending", "paid", "processing"];

function formatOrderNumber(orderNumber: string) {
  const segments = orderNumber.split("-");
  return segments.at(-1) ?? orderNumber;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseGuestField(notes: string | null | undefined, label: string) {
  const pattern = new RegExp(`${label}:\\s*([^|]+)`, "i");
  return notes?.match(pattern)?.[1]?.trim() ?? "";
}

function getGuestName(order: OrderDetail) {
  return order.customerName || parseGuestField(order.notes, "Guest") || "Online customer";
}

function getGuestPhone(order: OrderDetail) {
  return parseGuestField(order.notes, "Phone");
}

function getDeliveryAddress(order: OrderDetail) {
  return parseGuestField(order.notes, "Delivery to");
}

function getFulfillment(order: OrderDetail) {
  return getDeliveryAddress(order)
    ? order.shippingAmount > 0
      ? "Delivery"
      : "Free delivery"
    : "Pickup";
}

function StatusButton({
  orderId,
  status,
  label,
  variant = "ghost",
}: {
  orderId: string;
  status: OrderStatus;
  label: string;
  variant?: "primary" | "ghost";
}) {
  return (
    <form action={updateOnlineOrderStatusAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={status} />
      <Button
        type="submit"
        size="sm"
        variant={variant}
        className={cn(
          "h-10 rounded-xl",
          variant === "ghost" && "bg-white",
        )}
      >
        {label}
      </Button>
    </form>
  );
}

export function OnlineOrdersConsole({ orders }: { orders: OrderDetail[] }) {
  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const completedToday = orders.filter((order) => order.status === "completed").length;

  if (orders.length === 0) {
    return (
      <EmptyState
        title="No online orders yet"
        description="When customers place orders from the online shop, staff can manage them here."
        actionHref="/pos"
        actionLabel="Back to POS"
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal-700">
              Online queue
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-950">
              Online orders
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Review pickup and delivery orders, then move each order through preparation.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="font-mono text-xl font-semibold text-amber-700">
                {activeOrders.length}
              </p>
              <p className="text-xs font-medium text-amber-800/75">Waiting</p>
            </div>
            <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="font-mono text-xl font-semibold text-emerald-700">
                {completedToday}
              </p>
              <p className="text-xs font-medium text-emerald-800/75">Completed</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {orders.map((order) => {
          const phone = getGuestPhone(order);
          const address = getDeliveryAddress(order);
          const fulfillment = getFulfillment(order);

          return (
            <article
              key={order.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                    #{formatOrderNumber(order.orderNumber)}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">
                    {getGuestName(order)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {fulfillment} · {formatTime(order.createdAt)}
                    {phone ? ` · ${phone}` : ""}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              {address ? (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span className="font-semibold">Deliver to:</span> {address}
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {item.productName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">x{item.quantity}</p>
                    </div>
                    <span className="font-mono text-slate-950">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2 border-t border-dashed border-slate-200 pt-4 text-sm">
                <SummaryRow label="Subtotal" value={formatCurrency(order.subtotalAmount)} />
                <SummaryRow label="Tax" value={formatCurrency(order.taxAmount)} />
                <SummaryRow
                  label="Delivery"
                  value={order.shippingAmount > 0 ? formatCurrency(order.shippingAmount) : "Free"}
                />
                <SummaryRow
                  label="Total"
                  value={formatCurrency(order.totalAmount)}
                  strong
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {order.status === "pending" || order.status === "paid" ? (
                  <StatusButton
                    orderId={order.id}
                    status="processing"
                    label="Start preparing"
                    variant="primary"
                  />
                ) : null}
                {order.status === "processing" ? (
                  <StatusButton
                    orderId={order.id}
                    status="completed"
                    label="Complete order"
                    variant="primary"
                  />
                ) : null}
                {order.status !== "completed" && order.status !== "cancelled" ? (
                  <StatusButton orderId={order.id} status="cancelled" label="Cancel" />
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        strong && "font-semibold text-slate-950",
      )}
    >
      <span className={strong ? "text-slate-950" : "text-slate-500"}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
