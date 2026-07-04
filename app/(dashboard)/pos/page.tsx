import { PosWorkspace } from "@/components/pos/pos-workspace";
import { requirePermission } from "@/lib/auth/guards";
import { listOrders } from "@/lib/services/orders";
import { listCustomers, listProducts } from "@/lib/services/products";
import { getCurrencySettings } from "@/lib/services/currency-settings";

export default async function PosPage() {
  const profile = await requirePermission("pos", "/pos");
  const [products, customers, recentOrders, currencySettings] = await Promise.all([
    listProducts(),
    listCustomers(),
    listOrders({ roles: ["cashier"], channel: "pos", limit: 1 }),
    getCurrencySettings(),
  ]);

  const latestSale = recentOrders[0]
    ? {
        orderId: recentOrders[0].id,
        orderNumber: recentOrders[0].orderNumber,
        totalAmount: recentOrders[0].totalAmount,
        createdAt: recentOrders[0].createdAt,
      }
    : null;

  return (
    <PosWorkspace
      products={products}
      customers={customers}
      defaultView="register"
      lastTransaction={latestSale}
      cashierName={profile.fullName}
      khrRate={currencySettings.showKhr ? currencySettings.khrRate : 0}
      taxPercent={currencySettings.taxPercent}
    />
  );
}
