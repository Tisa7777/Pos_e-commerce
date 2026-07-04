import { OnlineOrdersConsole } from "@/components/pos/online-orders-console";
import { listOrders } from "@/lib/services/orders";

export default async function PosOnlineOrdersPage() {
  const orders = await listOrders({
    roles: ["cashier"],
    channel: "ecommerce",
    limit: 50,
  });

  return <OnlineOrdersConsole orders={orders} />;
}
