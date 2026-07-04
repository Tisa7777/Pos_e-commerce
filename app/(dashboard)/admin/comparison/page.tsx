import { getPeriodComparisons } from "@/lib/services/reports";
import { PeriodComparisonSection } from "@/components/dashboard/reports/period-comparison-section";
import { format } from "date-fns";

export default async function ComparisonPage() {
  const comparisons = await getPeriodComparisons();
  const lastUpdatedFormatted = format(new Date(), "MMM d, yyyy h:mm a");

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Analytics
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Period Comparison
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Matched-window analytics for revenue, orders, product movement, and sales channels.
            Last updated: {lastUpdatedFormatted}
          </p>
        </div>
      </div>

      <PeriodComparisonSection comparisons={comparisons} />
    </div>
  );
}
