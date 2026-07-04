import { AdminOperationsConsole } from "@/components/dashboard/admin-operations-console";
import { listLowStockProducts } from "@/lib/services/inventory";
import {
  getDashboardMetricSnapshot,
  getHourlySalesHeatmap,
  getRecentOrders,
  getSalesByCategory,
  getTopSellingProducts,
} from "@/lib/services/reports";

export default async function AdminDashboardPage() {
  const [metrics, recentOrders, lowStock, categorySales, hourlySales, topProducts] = await Promise.all([
    getDashboardMetricSnapshot(),
    getRecentOrders(12),
    listLowStockProducts(),
    getSalesByCategory(),
    getHourlySalesHeatmap(),
    getTopSellingProducts(),
  ]);

  return (
    <AdminOperationsConsole
      metrics={metrics}
      recentOrders={recentOrders}
      lowStock={lowStock}
      categorySales={categorySales}
      hourlySales={hourlySales}
      topProducts={topProducts}
    />
  );
}
