import { InventoryControlConsole } from "@/components/dashboard/inventory-control-console";
import { PageHeader } from "@/components/ui/page-header";
import {
  listInventoryMovements,
  listLowStockProducts,
} from "@/lib/services/inventory";
import { listProducts } from "@/lib/services/products";

export default async function InventoryPage() {
  const [products, lowStockProducts, movements] = await Promise.all([
    listProducts({ includeInactive: true }),
    listLowStockProducts(),
    listInventoryMovements(18),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Stock control"
        description="Use safer add and remove workflows, jump straight from the low-stock watchlist into restocking, and monitor the latest inventory movements in one place."
      />

      <InventoryControlConsole
        products={products}
        lowStockProducts={lowStockProducts}
        movements={movements}
      />
    </div>
  );
}
