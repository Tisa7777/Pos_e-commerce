import { PageHeader } from "@/components/ui/page-header";
import { AdminOrdersConsole } from "@/components/dashboard/admin-orders-console";
import { listOrders } from "@/lib/services/orders";

export default async function AdminOrdersPage() {
  const orders = await listOrders({
    roles: ["admin"],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Orders"
        description="All POS and online orders in one place. Click any row for the full receipt."
      />
      <AdminOrdersConsole orders={orders} />
    </div>
  );
}
