import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/types/domain";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const variant =
    status === "completed" || status === "paid"
      ? "success"
      : status === "pending" || status === "processing"
        ? "warning"
        : status === "cancelled" || status === "refunded"
          ? "danger"
          : "info";

  const label = status.replaceAll("_", " ");

  return (
    <Badge variant={variant} dot className="capitalize">
      {label}
    </Badge>
  );
}
