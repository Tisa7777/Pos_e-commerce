import { SalesAnalyticsDashboard } from "@/components/dashboard/reports/sales-analytics-dashboard";
import { getAnalyticsDashboardData } from "@/lib/services/reports";

export default async function ReportsPage() {
  const data = await getAnalyticsDashboardData();

  return <SalesAnalyticsDashboard data={data} />;
}
