import { SuppliersManager } from "@/components/dashboard/suppliers-manager";
import { listProducts, listSuppliers } from "@/lib/services/products";

export default async function SuppliersPage() {
  const [suppliers, products] = await Promise.all([
    listSuppliers(),
    listProducts({ includeInactive: true }),
  ]);

  return <SuppliersManager initialSuppliers={suppliers} products={products} />;
}
