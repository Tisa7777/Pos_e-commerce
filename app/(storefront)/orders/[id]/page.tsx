import { notFound } from "next/navigation";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/guards";
import { getOrderById } from "@/lib/services/orders";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser("/orders");
  const { id } = await params;
  const order = await getOrderById(id, profile);

  if (!order) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="Order detail"
        title={order.orderNumber}
        description={`Placed on ${formatDateTime(order.createdAt)}.`}
        action={<OrderStatusBadge status={order.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-950">{item.productName}</p>
                  <p className="text-sm text-slate-500">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-950">
                  {formatCurrency(item.lineTotal)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <Row label="Channel" value={order.channel} />
            <Row label="Payment status" value={order.paymentStatus} />
            <Row label="Subtotal" value={formatCurrency(order.subtotalAmount)} />
            <Row label="Discount" value={`-${formatCurrency(order.discountAmount)}`} />
            <Row label="Shipping" value={formatCurrency(order.shippingAmount)} />
            <Row label="Total" value={formatCurrency(order.totalAmount)} />
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="font-medium text-slate-950">Customer notes</p>
              <p className="mt-2">{order.notes ?? "No extra notes for this order."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-medium text-slate-950">{value}</span>
    </div>
  );
}
