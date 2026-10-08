/**
 * CSV export utilities for reports and analytics data.
 */

function escapeCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function buildCsvString(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  return lines.join("\n");
}

function triggerCsvDownload(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export interface ReportExportData {
  dateLabel: string;
  sourceLabel: string;
  totalRevenue: number;
  totalOrders: number;
  kpis: Array<{ label: string; formattedValue: string }>;
  topProducts: Array<{
    name: string;
    sku?: string;
    unitsSold: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    orderNumber: string;
    channel: string;
    status: string;
    totalAmount: number;
    customerName: string | null;
    createdAt: string;
  }>;
  cashierPerformance: Array<{
    name: string;
    salesCount: number;
    revenue: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    revenue: number;
    orders: number;
  }>;
}

export function exportReportCsv(data: ReportExportData) {
  const rows: Array<Array<string | number>> = [];

  // Section: Summary
  rows.push(["=== SALES REPORT SUMMARY ==="]);
  rows.push(["Date Range", data.dateLabel]);
  rows.push(["Source", data.sourceLabel]);
  rows.push(["Total Revenue", `$${data.totalRevenue.toFixed(2)}`]);
  rows.push(["Total Orders", data.totalOrders]);
  rows.push([]);

  // Section: KPIs
  rows.push(["=== KEY PERFORMANCE INDICATORS ==="]);
  rows.push(["Metric", "Value"]);
  for (const kpi of data.kpis) {
    rows.push([kpi.label, kpi.formattedValue]);
  }
  rows.push([]);

  // Section: Top Products
  if (data.topProducts.length > 0) {
    rows.push(["=== TOP PRODUCTS ==="]);
    rows.push(["Product", "SKU", "Units Sold", "Revenue"]);
    for (const product of data.topProducts) {
      rows.push([
        product.name,
        product.sku ?? "",
        product.unitsSold,
        `$${product.revenue.toFixed(2)}`,
      ]);
    }
    rows.push([]);
  }

  // Section: Payment Methods
  if (data.paymentMethods.length > 0) {
    rows.push(["=== PAYMENT METHODS ==="]);
    rows.push(["Method", "Count", "Total"]);
    for (const method of data.paymentMethods) {
      rows.push([method.method, method.count, `$${method.total.toFixed(2)}`]);
    }
    rows.push([]);
  }

  // Section: Cashier Performance
  if (data.cashierPerformance.length > 0) {
    rows.push(["=== CASHIER PERFORMANCE ==="]);
    rows.push(["Cashier", "Sales Count", "Revenue"]);
    for (const cashier of data.cashierPerformance) {
      rows.push([
        cashier.name,
        cashier.salesCount,
        `$${cashier.revenue.toFixed(2)}`,
      ]);
    }
    rows.push([]);
  }

  // Section: Category Breakdown
  if (data.categoryBreakdown.length > 0) {
    rows.push(["=== SALES BY CATEGORY ==="]);
    rows.push(["Category", "Revenue", "Orders"]);
    for (const category of data.categoryBreakdown) {
      rows.push([
        category.name,
        `$${category.revenue.toFixed(2)}`,
        category.orders,
      ]);
    }
    rows.push([]);
  }

  // Section: Recent Orders
  if (data.recentOrders.length > 0) {
    rows.push(["=== RECENT ORDERS ==="]);
    rows.push([
      "Order Number",
      "Channel",
      "Status",
      "Customer",
      "Total",
      "Date",
    ]);
    for (const order of data.recentOrders) {
      rows.push([
        order.orderNumber,
        order.channel,
        order.status,
        order.customerName ?? "Walk-in",
        `$${order.totalAmount.toFixed(2)}`,
        order.createdAt,
      ]);
    }
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const csv = buildCsvString([], rows);
  triggerCsvDownload(csv, `coffee-shop-sales-report-${dateSlug}.csv`);
}

export function exportReceiptCsv(receipts: Array<{
  orderNumber: string;
  customerName: string | null;
  cashierName: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
}>) {
  const headers = [
    "Order Number",
    "Customer",
    "Cashier",
    "Payment",
    "Product",
    "Qty",
    "Unit Price",
    "Line Total",
    "Order Total",
    "Date",
  ];

  const rows: Array<Array<string | number>> = [];
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      rows.push([
        receipt.orderNumber,
        receipt.customerName ?? "Walk-in",
        receipt.cashierName,
        receipt.paymentMethod,
        item.productName,
        item.quantity,
        `$${item.unitPrice.toFixed(2)}`,
        `$${item.lineTotal.toFixed(2)}`,
        `$${receipt.total.toFixed(2)}`,
        receipt.createdAt,
      ]);
    }
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const csv = buildCsvString(headers, rows);
  triggerCsvDownload(csv, `coffee-shop-pos-receipts-${dateSlug}.csv`);
}
