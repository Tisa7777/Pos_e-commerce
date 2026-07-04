import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { OrderDetail } from "@/types/domain";

export function RecentOrdersList({ orders }: { orders: OrderDetail[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white/70 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="flex items-center gap-3">
                <Link href={`/admin/orders`} className="font-semibold text-slate-950 hover:text-primary">
                  {order.orderNumber}
                </Link>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {order.customerName ?? "Guest"} • {formatDateTime(order.createdAt)}
              </p>
            </div>
            <div className="text-sm font-semibold text-slate-950">
              {formatCurrency(order.totalAmount)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
