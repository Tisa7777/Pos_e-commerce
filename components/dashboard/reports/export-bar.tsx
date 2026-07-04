"use client";

import { PremiumIcon } from "@/components/ui/premium-icon";
import { exportReportCsv, type ReportExportData } from "@/lib/export/csv";

export function ExportBar({
  totalOrders,
  totalRevenue,
  dateLabel,
  sourceLabel,
  exportData,
}: {
  totalOrders: number;
  totalRevenue: number;
  dateLabel: string;
  sourceLabel: string;
  exportData?: ReportExportData;
}) {
  function handleExportCSV() {
    if (exportData) {
      exportReportCsv(exportData);
      return;
    }

    // Fallback: simple summary CSV
    const header = "Metric,Value";
    const rows = [
      `Total Revenue,$${totalRevenue.toFixed(2)}`,
      `Total Orders,${totalOrders}`,
      `Date Range,${dateLabel}`,
      `Source,${sourceLabel}`,
    ];
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPDF() {
    window.print();
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <p className="text-sm text-slate-500">
          Showing data for:{" "}
          <span className="font-medium text-slate-700">{dateLabel}</span>
          {" · "}
          <span className="font-medium text-slate-700">{sourceLabel}</span>
          {" · "}
          <span className="font-mono font-medium text-slate-700">{totalOrders} orders</span>
          {" · "}
          <span className="font-mono font-semibold text-slate-950">${totalRevenue.toFixed(2)}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary"
          >
            <PremiumIcon name="pdf" className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary"
          >
            <PremiumIcon name="csv" className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary"
          >
            <PremiumIcon name="print" className="h-3.5 w-3.5" />
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}
