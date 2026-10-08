import { format, getHours, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import {
  isPostgresConfigured,
  isSupabaseConfigured,
} from "@/lib/env";
import { dbQuery } from "@/lib/db/postgres";
import { parsePosReceiptMetadata } from "@/lib/pos/receipt-metadata";
import {
  getCategoryIconName,
  getPaymentIconName,
  getProductIconName,
} from "@/lib/premium-icons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listLowStockProducts } from "@/lib/services/inventory";
import { listPosShiftsForRange } from "@/lib/services/pos-shifts";
import { listProducts } from "@/lib/services/products";
import type {
  AnalyticsDashboardData,
  CashierSalesDatum,
  DailySalesRow,
  DashboardMetrics,
  OrderDetail,
  OrderStatus,
  PaymentMethod,
  PeriodComparisonData,
  PeriodComparisonInsight,
  PeriodComparisonMetric,
  PeriodComparisonProductMover,
  PeriodComparisonSegment,
  PeriodComparisonSource,
  PeriodComparisonTopProduct,
  SaleChannel,
} from "@/types/domain";

export interface DashboardMetricTrend {
  currentValue: number;
  previousValue: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
  series: number[];
}

export interface DashboardMetricSnapshot extends DashboardMetrics {
  revenueTrend: DashboardMetricTrend;
  ordersTrend: DashboardMetricTrend;
  averageOrderTrend: DashboardMetricTrend;
  lowStockTrend: DashboardMetricTrend;
}

export interface CategorySalesDatum {
  label: string;
  revenue: number;
}

export interface HourlySalesDatum {
  hourLabel: string;
  revenue: number;
  orderCount: number;
  intensity: number;
}

export interface TopSellingProductDatum {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

interface DailyBucket {
  label: string;
  revenue: number;
  orders: number;
}

interface AnalyticsOrderItemRecord {
  productId: string;
  productName: string;
  quantity: number;
  lineTotal: number;
}

function getReportProductKey(item: Pick<AnalyticsOrderItemRecord, "productId" | "productName">) {
  return `${item.productId || "unknown"}::${item.productName}`;
}

interface AnalyticsOrderRecord {
  id: string;
  orderNumber: string;
  source: SaleChannel;
  customerName: string;
  cashierId?: string | null;
  cashierName?: string | null;
  notes?: string | null;
  createdAt: string;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod | string;
  items: AnalyticsOrderItemRecord[];
}

function buildTrend(currentValue: number, previousValue: number, series: number[]): DashboardMetricTrend {
  if (currentValue === previousValue) {
    return {
      currentValue,
      previousValue,
      changePercent: 0,
      direction: "flat",
      series,
    };
  }

  if (previousValue === 0) {
    return {
      currentValue,
      previousValue,
      changePercent: 100,
      direction: currentValue > 0 ? "up" : "down",
      series,
    };
  }

  const changePercent = ((currentValue - previousValue) / previousValue) * 100;

  return {
    currentValue,
    previousValue,
    changePercent,
    direction: changePercent > 0 ? "up" : "down",
    series,
  };
}

function buildRecentDayBuckets(records: Array<{ createdAt: string; totalAmount: number }>) {
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = subDays(startOfDay(new Date()), 6 - index);
    return format(date, "yyyy-MM-dd");
  });

  const buckets = new Map<string, DailyBucket>(
    labels.map((label) => [
      label,
      {
        label,
        revenue: 0,
        orders: 0,
      },
    ]),
  );

  for (const record of records) {
    const bucketKey = format(new Date(record.createdAt), "yyyy-MM-dd");
    const bucket = buckets.get(bucketKey);
    if (!bucket) {
      continue;
    }

    bucket.revenue += record.totalAmount;
    bucket.orders += 1;
  }

  return labels.map((label) => buckets.get(label)!);
}

function buildLowStockSeries(currentLowStockCount: number, orderSeries: number[]) {
  if (orderSeries.length === 0) {
    return Array.from({ length: 7 }, () => currentLowStockCount);
  }

  const averageOrders =
    orderSeries.reduce((sum, value) => sum + value, 0) / orderSeries.length || 1;

  return orderSeries.map((value, index) => {
    if (index === orderSeries.length - 1) {
      return currentLowStockCount;
    }

    const inferredDelta = Math.round(
      ((value - averageOrders) / averageOrders) * Math.max(1, Math.min(currentLowStockCount, 3)),
    );

    return Math.max(0, currentLowStockCount + inferredDelta);
  });
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (isPostgresConfigured()) {
    const todayIso = startOfDay(new Date()).toISOString();
    const [orders, lowStockProducts] = await Promise.all([
      loadAnalyticsOrders(new Date(todayIso)),
      listLowStockProducts(),
    ]);

    const revenueToday = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const ordersToday = orders.length;

    return {
      revenueToday,
      ordersToday,
      averageOrderValue: ordersToday > 0 ? revenueToday / ordersToday : 0,
      lowStockCount: lowStockProducts.length,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      revenueToday: 0,
      ordersToday: 0,
      averageOrderValue: 0,
      lowStockCount: 0,
    };
  }

  const todayIso = startOfDay(new Date()).toISOString();
  const supabase = await createSupabaseServerClient();
  const [{ data }, lowStockProducts] = await Promise.all([
    supabase
      .from("orders")
      .select("total_amount")
      .gte("created_at", todayIso)
      .in("payment_status", ["paid", "partially_refunded"]),
    listLowStockProducts(),
  ]);

  const revenueToday = (data ?? []).reduce(
    (sum, order) => sum + Number(order.total_amount),
    0,
  );
  const ordersToday = data?.length ?? 0;

  return {
    revenueToday,
    ordersToday,
    averageOrderValue: ordersToday > 0 ? revenueToday / ordersToday : 0,
    lowStockCount: lowStockProducts.length,
  };
}

export async function getDashboardMetricSnapshot(): Promise<DashboardMetricSnapshot> {
  if (isPostgresConfigured()) {
    const windowStartIso = startOfDay(subDays(new Date(), 6)).toISOString();
    const [recentOrders, lowStockProducts] = await Promise.all([
      loadAnalyticsOrders(new Date(windowStartIso)),
      listLowStockProducts(),
    ]);

    const dayBuckets = buildRecentDayBuckets(recentOrders);
    const revenueSeries = dayBuckets.map((bucket) => bucket.revenue);
    const orderSeries = dayBuckets.map((bucket) => bucket.orders);
    const averageOrderSeries = dayBuckets.map((bucket) =>
      bucket.orders > 0 ? bucket.revenue / bucket.orders : 0,
    );
    const lowStockSeries = buildLowStockSeries(lowStockProducts.length, orderSeries);

    return {
      revenueToday: revenueSeries[6] ?? 0,
      ordersToday: orderSeries[6] ?? 0,
      averageOrderValue: averageOrderSeries[6] ?? 0,
      lowStockCount: lowStockProducts.length,
      revenueTrend: buildTrend(revenueSeries[6], revenueSeries[5], revenueSeries),
      ordersTrend: buildTrend(orderSeries[6], orderSeries[5], orderSeries),
      averageOrderTrend: buildTrend(averageOrderSeries[6], averageOrderSeries[5], averageOrderSeries),
      lowStockTrend: buildTrend(lowStockSeries[6], lowStockSeries[5], lowStockSeries),
    };
  }

  if (!isSupabaseConfigured()) {
    const emptySeries = Array.from({ length: 7 }, () => 0);

    return {
      revenueToday: 0,
      ordersToday: 0,
      averageOrderValue: 0,
      lowStockCount: 0,
      revenueTrend: buildTrend(0, 0, emptySeries),
      ordersTrend: buildTrend(0, 0, emptySeries),
      averageOrderTrend: buildTrend(0, 0, emptySeries),
      lowStockTrend: buildTrend(0, 0, emptySeries),
    };
  }

  const supabase = await createSupabaseServerClient();
  const windowStartIso = startOfDay(subDays(new Date(), 6)).toISOString();
  const [{ data: recentOrders }, lowStockProducts] = await Promise.all([
    supabase
      .from("orders")
      .select("created_at, total_amount")
      .gte("created_at", windowStartIso)
      .in("payment_status", ["paid", "partially_refunded"]),
    listLowStockProducts(),
  ]);

  const normalizedOrders = (recentOrders ?? []).map((order) => ({
    createdAt: order.created_at,
    totalAmount: Number(order.total_amount),
  }));

  const dayBuckets = buildRecentDayBuckets(normalizedOrders);
  const revenueSeries = dayBuckets.map((bucket) => bucket.revenue);
  const orderSeries = dayBuckets.map((bucket) => bucket.orders);
  const averageOrderSeries = dayBuckets.map((bucket) =>
    bucket.orders > 0 ? bucket.revenue / bucket.orders : 0,
  );
  const lowStockSeries = buildLowStockSeries(lowStockProducts.length, orderSeries);

  return {
    revenueToday: revenueSeries[6] ?? 0,
    ordersToday: orderSeries[6] ?? 0,
    averageOrderValue: averageOrderSeries[6] ?? 0,
    lowStockCount: lowStockProducts.length,
    revenueTrend: buildTrend(revenueSeries[6] ?? 0, revenueSeries[5] ?? 0, revenueSeries),
    ordersTrend: buildTrend(orderSeries[6] ?? 0, orderSeries[5] ?? 0, orderSeries),
    averageOrderTrend: buildTrend(
      averageOrderSeries[6] ?? 0,
      averageOrderSeries[5] ?? 0,
      averageOrderSeries,
    ),
    lowStockTrend: buildTrend(
      lowStockSeries[6] ?? lowStockProducts.length,
      lowStockSeries[5] ?? lowStockProducts.length,
      lowStockSeries,
    ),
  };
}

export async function getDailySalesReport(): Promise<DailySalesRow[]> {
  if (isPostgresConfigured()) {
    const orders = await loadAnalyticsOrders(startOfDay(new Date()));
    const grouped = new Map<string, DailySalesRow>();

    for (const order of orders) {
      const method = normalizePaymentMethod(order.paymentMethod);
      const current = grouped.get(method) ?? {
        label: formatPaymentMethodLabel(method),
        grossSales: 0,
        orderCount: 0,
      };
      current.grossSales += order.totalAmount;
      current.orderCount += 1;
      grouped.set(method, current);
    }

    return Array.from(grouped.values());
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const todayIso = startOfDay(new Date()).toISOString();
  const { data } = await supabase
    .from("payments")
    .select("method, amount")
    .gte("created_at", todayIso)
    .eq("status", "paid");

  const grouped = new Map<string, DailySalesRow>();
  for (const payment of data ?? []) {
    const current = grouped.get(payment.method) ?? {
      label: payment.method,
      grossSales: 0,
      orderCount: 0,
    };
    current.grossSales += Number(payment.amount);
    current.orderCount += 1;
    grouped.set(payment.method, current);
  }

  return Array.from(grouped.values());
}

export async function getTopSellingProducts(): Promise<TopSellingProductDatum[]> {
  if (isPostgresConfigured()) {
    return buildTopProducts(await loadAnalyticsOrders(startOfDay(subDays(new Date(), 29))), new Map())
      .map((product) => ({
        id: product.id,
        name: product.name,
        unitsSold: product.unitsSold,
        revenue: product.revenue,
      }));
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("order_items")
    .select("product_id, product_name, quantity, line_total");

  const grouped = new Map<string, { id: string; name: string; unitsSold: number; revenue: number }>();

  for (const item of data ?? []) {
    const key = getReportProductKey({
      productId: item.product_id,
      productName: item.product_name,
    });
    const current = grouped.get(key) ?? {
      id: key,
      name: item.product_name,
      unitsSold: 0,
      revenue: 0,
    };

    current.unitsSold += item.quantity;
    current.revenue += Number(item.line_total);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.unitsSold - left.unitsSold)
    .slice(0, 5);
}

export async function getSalesByCategory(): Promise<CategorySalesDatum[]> {
  const baseCategories = ["Coffee & Tea", "Bakery", "Accessories"];

  if (isPostgresConfigured()) {
    const [orders, products] = await Promise.all([
      loadAnalyticsOrders(startOfDay(subDays(new Date(), 29))),
      listProducts({ includeInactive: true }),
    ]);
    const categoryByProductId = new Map(
      products.map((product) => [product.id, product.category?.name ?? "General"]),
    );
    const grouped = new Map<string, number>(baseCategories.map((label) => [label, 0]));

    for (const order of orders) {
      for (const item of order.items) {
        const categoryName = categoryByProductId.get(item.productId) ?? getFallbackCategoryLabel(item.productName);
        grouped.set(categoryName, (grouped.get(categoryName) ?? 0) + item.lineTotal);
      }
    }

    return baseCategories.map((label) => ({
      label,
      revenue: grouped.get(label) ?? 0,
    }));
  }

  if (!isSupabaseConfigured()) {
    return baseCategories.map((label) => ({
      label,
      revenue: 0,
    }));
  }

  const [products, supabase] = await Promise.all([
    listProducts({ includeInactive: true }),
    createSupabaseServerClient(),
  ]);

  const categoryByProductId = new Map(
    products.map((product) => [product.id, product.category?.name ?? "General"]),
  );

  const { data: orderItems } = await supabase.from("order_items").select("product_id, line_total");

  const grouped = new Map<string, number>(baseCategories.map((label) => [label, 0]));
  for (const item of (orderItems ?? []) as Array<{ product_id: string; line_total: number | string }>) {
    const categoryName = categoryByProductId.get(item.product_id) ?? "General";
    grouped.set(categoryName, (grouped.get(categoryName) ?? 0) + Number(item.line_total));
  }

  return baseCategories.map((label) => ({
    label,
    revenue: grouped.get(label) ?? 0,
  }));
}

export async function getHourlySalesHeatmap(): Promise<HourlySalesDatum[]> {
  const hours = Array.from({ length: 24 }, (_, index) => ({
    hourLabel: `${String(index).padStart(2, "0")}:00`,
    revenue: 0,
    orderCount: 0,
    intensity: 0,
  }));

  if (isPostgresConfigured()) {
    const orders = await loadAnalyticsOrders(startOfDay(new Date()));
    for (const order of orders) {
      const slot = getHours(new Date(order.createdAt));
      hours[slot].revenue += order.totalAmount;
      hours[slot].orderCount += 1;
    }

    const maxRevenue = Math.max(...hours.map((hour) => hour.revenue), 1);
    return hours.map((hour) => ({
      ...hour,
      intensity: hour.revenue / maxRevenue,
    }));
  }

  if (!isSupabaseConfigured()) {
    return hours;
  }

  const supabase = await createSupabaseServerClient();
  const todayIso = startOfDay(new Date()).toISOString();
  const { data } = await supabase
    .from("orders")
    .select("created_at, total_amount")
    .gte("created_at", todayIso)
    .in("payment_status", ["paid", "partially_refunded"]);

  for (const order of (data ?? []) as Array<{ created_at: string; total_amount: number | string }>) {
    const hour = getHours(new Date(order.created_at));
    hours[hour].revenue += Number(order.total_amount);
    hours[hour].orderCount += 1;
  }

  const maxRevenue = Math.max(...hours.map((hour) => hour.revenue), 1);
  return hours.map((hour) => ({
    ...hour,
    intensity: hour.revenue / maxRevenue,
  }));
}

export async function getRecentOrders(limit = 5) {
  if (isPostgresConfigured()) {
    const { rows: orders } = await dbQuery<{
      id: string;
      order_number: string;
      created_at: string;
      status: OrderDetail["status"];
      channel: "pos" | "ecommerce";
      payment_status: OrderDetail["paymentStatus"];
      subtotal_amount: number | string;
      discount_amount: number | string;
      tax_amount: number | string;
      shipping_amount: number | string;
      total_amount: number | string;
      notes: string | null;
      customer_name: string | null;
    }>(
      `
        select
          o.id,
          o.order_number,
          o.created_at,
          o.status,
          o.channel,
          o.payment_status,
          o.subtotal_amount,
          o.discount_amount,
          o.tax_amount,
          o.shipping_amount,
          o.total_amount,
          o.notes,
          c.full_name as customer_name
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        order by o.created_at desc
        limit $1
      `,
      [limit],
    );

    const orderIds = orders.map((order) => order.id);
    const { rows: items } = orderIds.length
      ? await dbQuery<{
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          sku: string;
          quantity: number;
          unit_price: number | string;
          discount_amount: number | string;
          line_total: number | string;
        }>(
          `
            select
              id,
              order_id,
              product_id,
              product_name,
              sku,
              quantity,
              unit_price,
              discount_amount,
              line_total
            from public.order_items
            where order_id = any($1::uuid[])
          `,
          [orderIds],
        )
      : { rows: [] };

    const itemMap = new Map<string, typeof items>();
    for (const item of items) {
      const existing = itemMap.get(item.order_id) ?? [];
      existing.push(item);
      itemMap.set(item.order_id, existing);
    }

    return orders.map((order) => {
      const metadata =
        order.channel === "pos" ? parsePosReceiptMetadata(order.notes) : null;

      return {
        id: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name ?? "Guest",
        createdAt: order.created_at,
        status: order.status,
        channel: order.channel,
        paymentStatus: order.payment_status,
        subtotalAmount: metadata?.displaySubtotal ?? Number(order.subtotal_amount),
        discountAmount: metadata?.displayDiscount ?? Number(order.discount_amount),
        taxAmount: metadata?.displayTax ?? Number(order.tax_amount),
        shippingAmount: Number(order.shipping_amount),
        totalAmount: metadata?.displayTotal ?? Number(order.total_amount),
        notes: order.channel === "pos" ? metadata?.noteText : order.notes,
        items: (itemMap.get(order.id) ?? []).map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          discountAmount: Number(item.discount_amount),
          lineTotal: Number(item.line_total),
        })),
      };
    });
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*, customers(full_name), order_items(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (
    (data ?? []) as Array<{
      id: string;
      order_number: string;
      created_at: string;
      status: OrderDetail["status"];
      channel: "pos" | "ecommerce";
      payment_status: OrderDetail["paymentStatus"];
      subtotal_amount: number | string;
      discount_amount: number | string;
      tax_amount: number | string;
      shipping_amount: number | string;
      total_amount: number | string;
      notes?: string | null;
      customers?: { full_name?: string | null } | null;
      order_items?: Array<{
        id: string;
        product_id: string;
        product_name: string;
        sku: string;
        quantity: number;
        unit_price: number | string;
        discount_amount: number | string;
        line_total: number | string;
      }> | null;
    }>
  ).map((order) => {
    const metadata =
      order.channel === "pos" ? parsePosReceiptMetadata(order.notes ?? null) : null;

    return {
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customers?.full_name ?? "Guest",
      totalAmount: metadata?.displayTotal ?? Number(order.total_amount),
      createdAt: order.created_at,
      status: order.status,
      channel: order.channel,
      paymentStatus: order.payment_status,
      subtotalAmount: metadata?.displaySubtotal ?? Number(order.subtotal_amount),
      discountAmount: metadata?.displayDiscount ?? Number(order.discount_amount),
      taxAmount: metadata?.displayTax ?? Number(order.tax_amount),
      shippingAmount: Number(order.shipping_amount),
      notes: order.channel === "pos" ? metadata?.noteText : order.notes,
      items:
        order.order_items?.map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          discountAmount: Number(item.discount_amount),
          lineTotal: Number(item.line_total),
        })) ?? [],
    };
  });
}

export type DatePreset = "today" | "yesterday" | "this_week" | "this_month";

function getDateRangeForPreset(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
    case "this_month":
      return { start: startOfMonth(now), end: now };
  }
}

function getBusinessHourLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function normalizePaymentMethod(method: string | null | undefined) {
  const value = method?.toLowerCase() ?? "cash";

  if (value.includes("qr")) {
    return "qr";
  }

  if (value.includes("card") || value.includes("bank")) {
    return "card";
  }

  if (value.includes("cash")) {
    return "cash";
  }

  return value || "cash";
}

function formatPaymentMethodLabel(method: string) {
  if (method === "qr") return "QR";
  if (method === "card") return "Card";
  if (method === "cash") return "Cash";

  return method
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getFallbackCategoryLabel(productName: string) {
  const keyword = productName.toLowerCase();

  if (keyword.includes("croissant") || keyword.includes("bakery") || keyword.includes("bread")) {
    return "Bakery";
  }

  if (keyword.includes("tumbler") || keyword.includes("accessor") || keyword.includes("travel")) {
    return "Accessories";
  }

  if (
    keyword.includes("coffee") ||
    keyword.includes("latte") ||
    keyword.includes("espresso") ||
    keyword.includes("tea")
  ) {
    return "Coffee & Tea";
  }

  return "General";
}

function buildAnalyticsCashierId(
  profileId: string | null | undefined,
  cashierName: string | null | undefined,
) {
  const name = cashierName?.trim().toLowerCase() || "cashier";

  if (profileId) {
    return `${profileId}:${name}`;
  }

  return `cashier:${name}`;
}

function buildCashierPerformanceGroupKey(cashierName: string) {
  return `cashier:${cashierName.toLowerCase().replace(/\s+/g, " ")}`;
}

async function loadAnalyticsOrders(since: Date): Promise<AnalyticsOrderRecord[]> {
  const sinceIso = since.toISOString();

  if (isPostgresConfigured()) {
    const { rows: orders } = await dbQuery<{
      id: string;
      order_number: string;
      channel: SaleChannel;
      status: OrderStatus;
      created_at: string;
      total_amount: number | string;
      customer_name: string | null;
      cashier_profile_id: string | null;
      cashier_name: string | null;
      notes: string | null;
      payment_method: PaymentMethod | null;
    }>(
      `
        select
          o.id,
          o.order_number,
          o.channel,
          o.status,
          o.created_at,
          o.total_amount,
          o.notes,
          c.full_name as customer_name,
          o.cashier_profile_id,
          cashier.full_name as cashier_name,
          pay.method as payment_method
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        left join public.profiles cashier on cashier.id = o.cashier_profile_id
        left join lateral (
          select p.method
          from public.payments p
          where p.order_id = o.id
          order by (p.status = 'paid') desc, p.created_at desc
          limit 1
        ) pay on true
        where o.created_at >= $1
          and o.payment_status in ('paid', 'partially_refunded')
          and o.status <> 'cancelled'
        order by o.created_at desc
      `,
      [sinceIso],
    );

    const orderIds = orders.map((order) => order.id);
    const { rows: items } = orderIds.length
      ? await dbQuery<{
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          line_total: number | string;
        }>(
          `
            select order_id, product_id, product_name, quantity, line_total
            from public.order_items
            where order_id = any($1::uuid[])
          `,
          [orderIds],
        )
      : { rows: [] };

    const itemsByOrderId = new Map<string, AnalyticsOrderItemRecord[]>();
    for (const item of items) {
      const orderItems = itemsByOrderId.get(item.order_id) ?? [];
      orderItems.push({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        lineTotal: Number(item.line_total),
      });
      itemsByOrderId.set(item.order_id, orderItems);
    }

    return orders.map((order) => {
      const metadata =
        order.channel === "pos" ? parsePosReceiptMetadata(order.notes) : null;
      const cashierName = metadata?.cashierName ?? order.cashier_name;

      return {
        id: order.id,
        orderNumber: order.order_number,
        source: order.channel,
        customerName: order.customer_name ?? "Guest",
        cashierId:
          order.channel === "pos"
            ? buildAnalyticsCashierId(order.cashier_profile_id, cashierName)
            : order.cashier_profile_id,
        cashierName,
        notes: order.notes,
        createdAt: order.created_at,
        totalAmount: metadata?.displayTotal ?? Number(order.total_amount),
        status: order.status,
        paymentMethod: order.payment_method ?? "cash",
        items: itemsByOrderId.get(order.id) ?? [],
      };
    });
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, channel, status, created_at, total_amount, notes, cashier_profile_id, customers(full_name), order_items(product_id, product_name, quantity, line_total), payments(method, status, amount)")
    .gte("created_at", sinceIso)
    .in("payment_status", ["paid", "partially_refunded"])
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const orderRows = (data ?? []) as Array<{
    id: string;
    order_number: string;
    channel: SaleChannel;
    status: OrderStatus;
    created_at: string;
    total_amount: number | string;
    notes?: string | null;
    cashier_profile_id?: string | null;
    customers?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
    order_items?: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      line_total: number | string;
    }> | null;
    payments?: Array<{ method?: PaymentMethod | string | null }> | null;
  }>;

  const cashierIds = Array.from(
    new Set(
      orderRows
        .map((order) => order.cashier_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const cashierNameById = new Map<string, string>();

  if (cashierIds.length > 0) {
    const { data: cashierProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", cashierIds);

    for (const cashier of (cashierProfiles ?? []) as Array<{
      id: string;
      full_name?: string | null;
      email?: string | null;
    }>) {
      cashierNameById.set(cashier.id, cashier.full_name ?? cashier.email ?? "Cashier");
    }
  }

  return orderRows.map((order) => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const payment = order.payments?.[0];
    const metadata =
      order.channel === "pos" ? parsePosReceiptMetadata(order.notes ?? null) : null;
    const cashierName = order.cashier_profile_id
      ? metadata?.cashierName ?? cashierNameById.get(order.cashier_profile_id) ?? "Cashier"
      : metadata?.cashierName ?? null;

    return {
      id: order.id,
      orderNumber: order.order_number,
      source: order.channel,
      customerName: customer?.full_name ?? "Guest",
      cashierId:
        order.channel === "pos"
          ? buildAnalyticsCashierId(order.cashier_profile_id, cashierName)
          : order.cashier_profile_id ?? null,
      cashierName,
      notes: order.notes ?? null,
      createdAt: order.created_at,
      totalAmount: metadata?.displayTotal ?? Number(order.total_amount),
      status: order.status,
      paymentMethod: payment?.method ?? "cash",
      items:
        order.order_items?.map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          lineTotal: Number(item.line_total),
        })) ?? [],
    };
  });
}

function buildRevenueTimeline(orders: AnalyticsOrderRecord[], preset: DatePreset = "today") {
  // For today and yesterday, show hourly buckets
  if (preset === "today" || preset === "yesterday") {
    const hours = Array.from({ length: 18 }, (_, index) => index + 6);
    const buckets = new Map(
      hours.map((hour) => [
        hour,
        {
          label: getBusinessHourLabel(hour),
          posRevenue: 0,
          onlineRevenue: 0,
          posOrders: 0,
          onlineOrders: 0,
        },
      ]),
    );

    for (const order of orders) {
      const hour = getHours(new Date(order.createdAt));
      const bucket = buckets.get(hour);
      if (!bucket) {
        continue;
      }

      if (order.source === "pos") {
        bucket.posRevenue += order.totalAmount;
        bucket.posOrders += 1;
      } else {
        bucket.onlineRevenue += order.totalAmount;
        bucket.onlineOrders += 1;
      }
    }

    return hours.map((hour) => buckets.get(hour)!);
  }

  // For this_week and this_month, show daily buckets
  const { start, end } = getDateRangeForPreset(preset);
  const dayLabels: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dayLabels.push(format(cursor, "yyyy-MM-dd"));
    cursor.setDate(cursor.getDate() + 1);
  }

  const buckets = new Map(
    dayLabels.map((dateKey) => [
      dateKey,
      {
        label: format(new Date(dateKey), "MMM d"),
        posRevenue: 0,
        onlineRevenue: 0,
        posOrders: 0,
        onlineOrders: 0,
      },
    ]),
  );

  for (const order of orders) {
    const dateKey = format(new Date(order.createdAt), "yyyy-MM-dd");
    const bucket = buckets.get(dateKey);
    if (!bucket) continue;

    if (order.source === "pos") {
      bucket.posRevenue += order.totalAmount;
      bucket.posOrders += 1;
    } else {
      bucket.onlineRevenue += order.totalAmount;
      bucket.onlineOrders += 1;
    }
  }

  return dayLabels.map((key) => buckets.get(key)!);
}

function buildPaymentMethods(orders: AnalyticsOrderRecord[]) {
  const grouped = new Map(
    ["cash", "card", "qr"].map((method) => [
      method,
      {
        method: formatPaymentMethodLabel(method),
        iconName: getPaymentIconName(method),
        totalPayments: 0,
        totalAmount: 0,
        posAmount: 0,
        onlineAmount: 0,
      },
    ]),
  );

  for (const order of orders) {
    const method = normalizePaymentMethod(order.paymentMethod);
    const current =
      grouped.get(method) ??
      {
        method: formatPaymentMethodLabel(method),
        iconName: getPaymentIconName(method),
        totalPayments: 0,
        totalAmount: 0,
        posAmount: 0,
        onlineAmount: 0,
      };

    current.totalPayments += 1;
    current.totalAmount += order.totalAmount;
    if (order.source === "pos") {
      current.posAmount += order.totalAmount;
    } else {
      current.onlineAmount += order.totalAmount;
    }
    grouped.set(method, current);
  }

  return Array.from(grouped.values());
}

function buildTopProducts(
  orders: AnalyticsOrderRecord[],
  categoryByProductId: Map<string, string>,
) {
  const grouped = new Map<
    string,
    {
      id: string;
      productId: string;
      name: string;
      unitsSold: number;
      revenue: number;
      hasPos: boolean;
      hasOnline: boolean;
    }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const key = getReportProductKey(item);
      const current =
        grouped.get(key) ??
        {
          id: key,
          productId: item.productId,
          name: item.productName,
          unitsSold: 0,
          revenue: 0,
          hasPos: false,
          hasOnline: false,
        };

      current.unitsSold += item.quantity;
      current.revenue += item.lineTotal;
      current.hasPos = current.hasPos || order.source === "pos";
      current.hasOnline = current.hasOnline || order.source !== "pos";
      grouped.set(key, current);
    }
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.unitsSold - left.unitsSold)
    .slice(0, 5)
    .map((product) => {
      const categoryName =
        categoryByProductId.get(product.productId) ?? getFallbackCategoryLabel(product.name);
      const channel: "pos" | "online" | "both" =
        product.hasPos && product.hasOnline
          ? "both"
          : product.hasPos
            ? "pos"
            : "online";

      return {
        id: product.id,
        name: product.name,
        iconName: getProductIconName(product.name, categoryName),
        unitsSold: product.unitsSold,
        revenue: product.revenue,
        channel,
      };
    });
}

function buildCategoryBreakdown(
  orders: AnalyticsOrderRecord[],
  categoryByProductId: Map<string, string>,
) {
  const baseCategories = ["Coffee & Tea", "Bakery", "Accessories"];
  const grouped = new Map(
    baseCategories.map((label) => [
      label,
      {
        label,
        iconName: getCategoryIconName(label),
        posRevenue: 0,
        onlineRevenue: 0,
      },
    ]),
  );

  for (const order of orders) {
    for (const item of order.items) {
      const label =
        categoryByProductId.get(item.productId) ?? getFallbackCategoryLabel(item.productName);
      const current =
        grouped.get(label) ??
        {
          label,
          iconName: getCategoryIconName(label),
          posRevenue: 0,
          onlineRevenue: 0,
        };

      if (order.source === "pos") {
        current.posRevenue += item.lineTotal;
      } else {
        current.onlineRevenue += item.lineTotal;
      }
      grouped.set(label, current);
    }
  }

  return Array.from(grouped.values());
}

function buildChannelSummary(
  orders: AnalyticsOrderRecord[],
  source: SaleChannel,
  timeline: AnalyticsDashboardData["revenueTimeline"],
) {
  const channelOrders = orders.filter((order) => order.source === source);
  const revenue = channelOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const ordersCount = channelOrders.length;
  const productTotals = new Map<string, { name: string; units: number }>();

  for (const order of channelOrders) {
    for (const item of order.items) {
      const key = getReportProductKey(item);
      const current = productTotals.get(key) ?? {
        name: item.productName,
        units: 0,
      };
      current.units += item.quantity;
      productTotals.set(key, current);
    }
  }

  const topProduct = Array.from(productTotals.values()).sort(
    (left, right) => right.units - left.units,
  )[0];

  const peak = [...timeline].sort((left, right) => {
    const leftRevenue = source === "pos" ? left.posRevenue : left.onlineRevenue;
    const rightRevenue = source === "pos" ? right.posRevenue : right.onlineRevenue;
    return rightRevenue - leftRevenue;
  })[0];
  const peakRevenue = peak ? (source === "pos" ? peak.posRevenue : peak.onlineRevenue) : 0;

  return {
    revenue,
    orders: ordersCount,
    avgOrder: ordersCount > 0 ? revenue / ordersCount : 0,
    topItem: topProduct?.name ?? "No sales",
    peakHour: peakRevenue > 0 ? peak.label : "No sales",
  };
}

function buildCashierPerformance(orders: AnalyticsOrderRecord[]): CashierSalesDatum[] {
  const posOrders = orders.filter((order) => order.source === "pos");
  const totalPosRevenue = posOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const grouped = new Map<
    string,
    {
      cashierId: string;
      cashierName: string;
      orders: number;
      revenue: number;
      unitsSold: number;
      firstSaleAt?: string | null;
      lastSaleAt?: string | null;
      largestOrderTotal: number;
      largestOrderNumber?: string | null;
      productTotals: Map<
        string,
        {
          name: string;
          units: number;
          revenue: number;
        }
      >;
    }
  >();

  for (const order of posOrders) {
    const cashierName = order.cashierName?.trim() || "Unassigned Cashier";
    const cashierId = buildCashierPerformanceGroupKey(cashierName);
    const current =
      grouped.get(cashierId) ??
      {
        cashierId,
        cashierName,
        orders: 0,
        revenue: 0,
        unitsSold: 0,
        firstSaleAt: null,
        lastSaleAt: null,
        largestOrderTotal: 0,
        largestOrderNumber: null,
        productTotals: new Map(),
      };

    current.orders += 1;
    current.revenue += order.totalAmount;
    current.unitsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);

    if (order.totalAmount > current.largestOrderTotal) {
      current.largestOrderTotal = order.totalAmount;
      current.largestOrderNumber = order.orderNumber;
    }

    for (const item of order.items) {
      const productKey = getReportProductKey(item);
      const product =
        current.productTotals.get(productKey) ??
        {
          name: item.productName,
          units: 0,
          revenue: 0,
        };

      product.units += item.quantity;
      product.revenue += item.lineTotal;
      current.productTotals.set(productKey, product);
    }

    if (
      !current.firstSaleAt ||
      new Date(order.createdAt).getTime() < new Date(current.firstSaleAt).getTime()
    ) {
      current.firstSaleAt = order.createdAt;
    }

    if (
      !current.lastSaleAt ||
      new Date(order.createdAt).getTime() > new Date(current.lastSaleAt).getTime()
    ) {
      current.lastSaleAt = order.createdAt;
    }

    grouped.set(cashierId, current);
  }

  return Array.from(grouped.values())
    .map((cashier) => {
      const topProduct = Array.from(cashier.productTotals.values()).sort(
        (left, right) => right.units - left.units || right.revenue - left.revenue,
      )[0];

      return {
        cashierId: cashier.cashierId,
        cashierName: cashier.cashierName,
        orders: cashier.orders,
        revenue: cashier.revenue,
        unitsSold: cashier.unitsSold,
        firstSaleAt: cashier.firstSaleAt,
        lastSaleAt: cashier.lastSaleAt,
        largestOrderTotal: cashier.largestOrderTotal,
        largestOrderNumber: cashier.largestOrderNumber,
        topProductName: topProduct?.name ?? null,
        topProductUnits: topProduct?.units ?? 0,
        avgOrder: cashier.orders > 0 ? cashier.revenue / cashier.orders : 0,
        sharePercent: totalPosRevenue > 0 ? (cashier.revenue / totalPosRevenue) * 100 : 0,
      };
    })
    .sort((left, right) => right.revenue - left.revenue || right.orders - left.orders);
}

type ComparisonBucketMode = "hour" | "weekday" | "month-week";

interface ComparisonDefinition {
  currentLabel: string;
  previousLabel: string;
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  dailyLabels: string[];
  bucketMode: ComparisonBucketMode;
}

interface ProductComparisonAccumulator {
  id: string;
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  hasPos: boolean;
  hasOnline: boolean;
}

const COMPARISON_SOURCES: PeriodComparisonSource[] = ["all", "pos", "online"];

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function getComparisonSourceLabel(source: PeriodComparisonSource) {
  if (source === "pos") return "POS";
  if (source === "online") return "Online";

  return "All sales";
}

function matchesComparisonSource(order: AnalyticsOrderRecord, source: PeriodComparisonSource) {
  if (source === "all") return true;
  if (source === "pos") return order.source === "pos";

  return order.source === "ecommerce";
}

function getComparisonChannel(hasPos: boolean, hasOnline: boolean): "pos" | "online" | "both" {
  if (hasPos && hasOnline) return "both";
  if (hasPos) return "pos";

  return "online";
}

function getComparablePreviousEnd(
  previousStart: Date,
  currentStart: Date,
  currentEnd: Date,
  previousMaxEnd: Date,
) {
  const elapsed = Math.max(0, currentEnd.getTime() - currentStart.getTime());
  const comparableEnd = new Date(previousStart.getTime() + elapsed);

  return comparableEnd > previousMaxEnd ? previousMaxEnd : comparableEnd;
}

function formatComparisonDateRange(start: Date, end: Date, includeTime = false) {
  if (includeTime) {
    return `${format(start, "MMM d h:mm a")} - ${format(end, "h:mm a")}`;
  }

  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
}

function isOrderWithinRange(order: AnalyticsOrderRecord, start: Date, end: Date) {
  const createdAt = new Date(order.createdAt);
  return createdAt >= start && createdAt <= end;
}

function getComparisonBucketIndex(date: Date, mode: ComparisonBucketMode) {
  if (mode === "hour") {
    return getHours(date);
  }

  if (mode === "weekday") {
    return (date.getDay() + 6) % 7;
  }

  return Math.min(Math.floor((date.getDate() - 1) / 7), 4);
}

function buildRevenueBuckets(
  orders: AnalyticsOrderRecord[],
  bucketCount: number,
  bucketMode: ComparisonBucketMode,
) {
  const buckets = Array.from({ length: bucketCount }, () => 0);

  for (const order of orders) {
    const bucketIndex = getComparisonBucketIndex(new Date(order.createdAt), bucketMode);
    if (bucketIndex < 0 || bucketIndex >= buckets.length) {
      continue;
    }

    buckets[bucketIndex] += order.totalAmount;
  }

  return buckets;
}

function countComparisonUnits(orders: AnalyticsOrderRecord[]) {
  return orders.reduce(
    (sum, order) =>
      sum + order.items.reduce((orderSum, item) => orderSum + item.quantity, 0),
    0,
  );
}

function buildProductComparisonTotals(orders: AnalyticsOrderRecord[]) {
  const totals = new Map<string, ProductComparisonAccumulator>();

  for (const order of orders) {
    for (const item of order.items) {
      const id = getReportProductKey(item);
      const current =
        totals.get(id) ??
        {
          id,
          productId: item.productId,
          name: item.productName,
          unitsSold: 0,
          revenue: 0,
          hasPos: false,
          hasOnline: false,
        };

      current.name = current.name || item.productName;
      current.unitsSold += item.quantity;
      current.revenue += item.lineTotal;
      current.hasPos = current.hasPos || order.source === "pos";
      current.hasOnline = current.hasOnline || order.source !== "pos";
      totals.set(id, current);
    }
  }

  return totals;
}

function buildComparisonTopProducts(
  orders: AnalyticsOrderRecord[],
  categoryByProductId: Map<string, string>,
): PeriodComparisonTopProduct[] {
  return Array.from(buildProductComparisonTotals(orders).values())
    .sort((left, right) => right.revenue - left.revenue || right.unitsSold - left.unitsSold)
    .slice(0, 5)
    .map((product) => ({
      id: product.id,
      name: product.name,
      iconName: getProductIconName(product.name, categoryByProductId.get(product.productId)),
      unitsSold: product.unitsSold,
      revenue: product.revenue,
      channel: getComparisonChannel(product.hasPos, product.hasOnline),
    }));
}

function buildProductMovers(
  currentOrders: AnalyticsOrderRecord[],
  previousOrders: AnalyticsOrderRecord[],
  categoryByProductId: Map<string, string>,
): PeriodComparisonProductMover[] {
  const currentTotals = buildProductComparisonTotals(currentOrders);
  const previousTotals = buildProductComparisonTotals(previousOrders);
  const productIds = new Set([...currentTotals.keys(), ...previousTotals.keys()]);

  return Array.from(productIds)
    .map((id) => {
      const current = currentTotals.get(id);
      const previous = previousTotals.get(id);
      const name = current?.name ?? previous?.name ?? "Unknown product";
      const currentRevenue = current?.revenue ?? 0;
      const previousRevenue = previous?.revenue ?? 0;
      const revenueDelta = currentRevenue - previousRevenue;
      const changePercent =
        previousRevenue === 0
          ? currentRevenue > 0
            ? 100
            : 0
          : ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      const direction: "up" | "down" | "flat" =
        revenueDelta > 0.5 ? "up" : revenueDelta < -0.5 ? "down" : "flat";
      const hasPos = Boolean(current?.hasPos || previous?.hasPos);
      const hasOnline = Boolean(current?.hasOnline || previous?.hasOnline);

      return {
        id,
        name,
        iconName: getProductIconName(
          name,
          categoryByProductId.get(current?.productId ?? previous?.productId ?? id),
        ),
        currentUnits: current?.unitsSold ?? 0,
        previousUnits: previous?.unitsSold ?? 0,
        unitsDelta: (current?.unitsSold ?? 0) - (previous?.unitsSold ?? 0),
        currentRevenue,
        previousRevenue,
        revenueDelta,
        changePercent: Math.round(changePercent * 10) / 10,
        direction,
        channel: getComparisonChannel(hasPos, hasOnline),
      };
    })
    .sort(
      (left, right) =>
        Math.abs(right.revenueDelta) - Math.abs(left.revenueDelta) ||
        right.currentRevenue - left.currentRevenue,
    )
    .slice(0, 8);
}

function getInsightTone(direction: "up" | "down" | "flat") {
  if (direction === "up") return "positive" as const;
  if (direction === "down") return "negative" as const;

  return "neutral" as const;
}

function buildComparisonInsights(
  sourceLabel: string,
  metrics: PeriodComparisonMetric[],
  productMovers: PeriodComparisonProductMover[],
): PeriodComparisonInsight[] {
  const revenueMetric = metrics.find((metric) => metric.label === "Revenue")!;
  const orderMetric = metrics.find((metric) => metric.label === "Orders")!;
  const averageOrderMetric = metrics.find((metric) => metric.label === "Avg Order")!;
  const strongestGain = productMovers.find((product) => product.direction === "up");
  const strongestDrop = productMovers.find((product) => product.direction === "down");
  const featuredProduct = strongestGain ?? strongestDrop;

  const insights: PeriodComparisonInsight[] = [
    {
      title: "Revenue momentum",
      value:
        revenueMetric.direction === "flat"
          ? "Stable"
          : `${revenueMetric.direction === "up" ? "+" : "-"}${Math.abs(revenueMetric.changePercent)}%`,
      detail: `${sourceLabel} revenue moved from ${revenueMetric.formattedPrevious} to ${revenueMetric.formattedCurrent}.`,
      tone: getInsightTone(revenueMetric.direction),
      iconName: "revenue",
    },
    {
      title: "Order volume",
      value:
        orderMetric.direction === "flat"
          ? "No change"
          : `${orderMetric.direction === "up" ? "+" : "-"}${Math.abs(orderMetric.currentValue - orderMetric.previousValue)}`,
      detail: `${orderMetric.formattedCurrent} orders now vs ${orderMetric.formattedPrevious} before.`,
      tone: getInsightTone(orderMetric.direction),
      iconName: "orders",
    },
    {
      title: "Basket quality",
      value:
        averageOrderMetric.direction === "flat"
          ? "Steady"
          : `${averageOrderMetric.direction === "up" ? "+" : "-"}${Math.abs(averageOrderMetric.changePercent)}%`,
      detail: `Average order is ${averageOrderMetric.formattedCurrent}, previously ${averageOrderMetric.formattedPrevious}.`,
      tone: getInsightTone(averageOrderMetric.direction),
      iconName: "avg-order",
    },
  ];

  if (featuredProduct) {
    insights.push({
      title: featuredProduct.direction === "up" ? "Product lift" : "Product watch",
      value: featuredProduct.name,
      detail: `${formatMoney(Math.abs(featuredProduct.revenueDelta))} ${
        featuredProduct.direction === "up" ? "above" : "below"
      } the previous period.`,
      tone: featuredProduct.direction === "up" ? "positive" : "warning",
      iconName: featuredProduct.iconName,
    });
  } else {
    insights.push({
      title: "Product movement",
      value: "No movement",
      detail: "No product-level sales changes appeared in this period.",
      tone: "neutral",
      iconName: "package",
    });
  }

  return insights;
}

function buildComparisonMetrics(
  curRevenue: number,
  prevRevenue: number,
  curOrders: number,
  prevOrders: number,
  curAvg: number,
  prevAvg: number,
): PeriodComparisonMetric[] {
  return [
    buildSingleMetric("Revenue", curRevenue, prevRevenue, true),
    buildSingleMetric("Orders", curOrders, prevOrders, false),
    buildSingleMetric("Avg Order", curAvg, prevAvg, true),
  ];
}

function buildSingleMetric(
  label: string,
  current: number,
  previous: number,
  isCurrency: boolean,
): PeriodComparisonMetric {
  const changePercent =
    previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const direction: "up" | "down" | "flat" =
    changePercent > 0.5 ? "up" : changePercent < -0.5 ? "down" : "flat";

  return {
    label,
    currentValue: current,
    previousValue: previous,
    formattedCurrent: isCurrency ? formatMoney(current) : String(current),
    formattedPrevious: isCurrency ? formatMoney(previous) : String(previous),
    changePercent: Math.round(changePercent * 10) / 10,
    direction,
  };
}

function buildComparisonSegment(
  source: PeriodComparisonSource,
  currentOrders: AnalyticsOrderRecord[],
  previousOrders: AnalyticsOrderRecord[],
  bucketCount: number,
  bucketMode: ComparisonBucketMode,
  categoryByProductId: Map<string, string>,
): PeriodComparisonSegment {
  const filteredCurrentOrders = currentOrders.filter((order) =>
    matchesComparisonSource(order, source),
  );
  const filteredPreviousOrders = previousOrders.filter((order) =>
    matchesComparisonSource(order, source),
  );
  const currentRevenue = filteredCurrentOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const previousRevenue = filteredPreviousOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const currentOrdersCount = filteredCurrentOrders.length;
  const previousOrdersCount = filteredPreviousOrders.length;
  const currentAverageOrder = currentOrdersCount > 0 ? currentRevenue / currentOrdersCount : 0;
  const previousAverageOrder = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0;
  const metrics = buildComparisonMetrics(
    currentRevenue,
    previousRevenue,
    currentOrdersCount,
    previousOrdersCount,
    currentAverageOrder,
    previousAverageOrder,
  );
  const productMovers = buildProductMovers(
    filteredCurrentOrders,
    filteredPreviousOrders,
    categoryByProductId,
  );

  return {
    source,
    sourceLabel: getComparisonSourceLabel(source),
    metrics,
    currentDailyRevenue: buildRevenueBuckets(filteredCurrentOrders, bucketCount, bucketMode),
    previousDailyRevenue: buildRevenueBuckets(filteredPreviousOrders, bucketCount, bucketMode),
    currentRevenue,
    previousRevenue,
    currentOrders: currentOrdersCount,
    previousOrders: previousOrdersCount,
    currentUnits: countComparisonUnits(filteredCurrentOrders),
    previousUnits: countComparisonUnits(filteredPreviousOrders),
    topProducts: buildComparisonTopProducts(filteredCurrentOrders, categoryByProductId),
    productMovers,
    insights: buildComparisonInsights(getComparisonSourceLabel(source), metrics, productMovers),
  };
}

function buildPeriodComparison(
  definition: ComparisonDefinition,
  orders: AnalyticsOrderRecord[],
  categoryByProductId: Map<string, string>,
): PeriodComparisonData {
  const currentOrders = orders.filter((order) =>
    isOrderWithinRange(order, definition.currentStart, definition.currentEnd),
  );
  const previousOrders = orders.filter((order) =>
    isOrderWithinRange(order, definition.previousStart, definition.previousEnd),
  );
  const segments = COMPARISON_SOURCES.map((source) =>
    buildComparisonSegment(
      source,
      currentOrders,
      previousOrders,
      definition.dailyLabels.length,
      definition.bucketMode,
      categoryByProductId,
    ),
  );
  const allSegment = segments.find((segment) => segment.source === "all")!;

  return {
    currentLabel: definition.currentLabel,
    previousLabel: definition.previousLabel,
    currentDateRange: formatComparisonDateRange(
      definition.currentStart,
      definition.currentEnd,
      definition.bucketMode === "hour",
    ),
    previousDateRange: formatComparisonDateRange(
      definition.previousStart,
      definition.previousEnd,
      definition.bucketMode === "hour",
    ),
    metrics: allSegment.metrics,
    currentDailyRevenue: allSegment.currentDailyRevenue,
    previousDailyRevenue: allSegment.previousDailyRevenue,
    dailyLabels: definition.dailyLabels,
    segments,
  };
}

export async function getPeriodComparisons(): Promise<PeriodComparisonData[]> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd = endOfDay(subDays(now, 1));
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const earliestStart = new Date(
    Math.min(yesterdayStart.getTime(), lastWeekStart.getTime(), lastMonthStart.getTime()),
  );

  const [orders, products] = await Promise.all([
    loadAnalyticsOrders(earliestStart),
    listProducts({ includeInactive: true }),
  ]);
  const categoryByProductId = new Map(
    products.map((product) => [product.id, product.category?.name ?? "General"]),
  );

  const definitions: ComparisonDefinition[] = [
    {
      currentLabel: "Today",
      previousLabel: "Yesterday",
      currentStart: todayStart,
      currentEnd: now,
      previousStart: yesterdayStart,
      previousEnd: getComparablePreviousEnd(yesterdayStart, todayStart, now, yesterdayEnd),
      dailyLabels: Array.from({ length: 24 }, (_, hour) => getBusinessHourLabel(hour)),
      bucketMode: "hour",
    },
    {
      currentLabel: "This Week",
      previousLabel: "Last Week",
      currentStart: thisWeekStart,
      currentEnd: now,
      previousStart: lastWeekStart,
      previousEnd: getComparablePreviousEnd(lastWeekStart, thisWeekStart, now, lastWeekEnd),
      dailyLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      bucketMode: "weekday",
    },
    {
      currentLabel: "This Month",
      previousLabel: "Last Month",
      currentStart: thisMonthStart,
      currentEnd: now,
      previousStart: lastMonthStart,
      previousEnd: getComparablePreviousEnd(lastMonthStart, thisMonthStart, now, lastMonthEnd),
      dailyLabels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
      bucketMode: "month-week",
    },
  ];

  return definitions.map((definition) =>
    buildPeriodComparison(definition, orders, categoryByProductId),
  );
}

export async function getAnalyticsDashboardData(preset: DatePreset = "today"): Promise<AnalyticsDashboardData> {
  const now = new Date();
  const { start: rangeStart } = getDateRangeForPreset(preset);
  // Also load 7-day window for trend sparklines
  const trendWindowStart = startOfDay(subDays(now, 6));
  const effectiveStart = rangeStart < trendWindowStart ? rangeStart : trendWindowStart;

  const [allOrders, products, lowStockProducts] = await Promise.all([
    loadAnalyticsOrders(effectiveStart),
    listProducts({ includeInactive: true }),
    listLowStockProducts(),
  ]);

  // Filter orders to the requested date range
  const { start, end } = getDateRangeForPreset(preset);
  const filteredOrders = allOrders.filter((order) => {
    const d = new Date(order.createdAt);
    return d >= start && d <= end;
  });

  // Also keep orders from last 7 days for trend sparklines
  const trendOrders = allOrders.filter((order) => new Date(order.createdAt) >= trendWindowStart);

  const categoryByProductId = new Map(
    products.map((product) => [product.id, product.category?.name ?? "General"]),
  );
  const dayBuckets = buildRecentDayBuckets(
    trendOrders.map((order) => ({
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
    })),
  );
  const revenueSeries = dayBuckets.map((bucket) => bucket.revenue);
  const orderSeries = dayBuckets.map((bucket) => bucket.orders);
  const averageOrderSeries = dayBuckets.map((bucket) =>
    bucket.orders > 0 ? bucket.revenue / bucket.orders : 0,
  );
  const lowStockSeries = buildLowStockSeries(lowStockProducts.length, orderSeries);

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalOrderCount = filteredOrders.length;
  const averageOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;
  const revenueTimeline = buildRevenueTimeline(filteredOrders, preset);
  const posSummary = buildChannelSummary(filteredOrders, "pos", revenueTimeline);
  const onlineSummary = buildChannelSummary(filteredOrders, "ecommerce", revenueTimeline);
  const cashierPerformance = buildCashierPerformance(filteredOrders);
  const posShifts = await listPosShiftsForRange(start, end);

  const changeLabel = preset === "today" ? "vs yesterday" : preset === "yesterday" ? "vs day before" : "trend";

  return {
    lastUpdated: new Date().toISOString(),
    totalRevenue,
    totalOrders: totalOrderCount,
    kpis: [
      {
        label: "Revenue",
        value: totalRevenue,
        formattedValue: `$${totalRevenue.toFixed(2)}`,
        iconName: "revenue",
        changePercent: buildTrend(
          revenueSeries[6] ?? 0,
          revenueSeries[5] ?? 0,
          revenueSeries,
        ).changePercent,
        changeLabel,
        direction: buildTrend(revenueSeries[6] ?? 0, revenueSeries[5] ?? 0, revenueSeries).direction,
        series: revenueSeries,
      },
      {
        label: "Orders",
        value: totalOrderCount,
        formattedValue: String(totalOrderCount),
        iconName: "orders",
        changePercent: buildTrend(orderSeries[6] ?? 0, orderSeries[5] ?? 0, orderSeries)
          .changePercent,
        changeLabel,
        direction: buildTrend(orderSeries[6] ?? 0, orderSeries[5] ?? 0, orderSeries).direction,
        series: orderSeries,
      },
      {
        label: "Avg Order",
        value: averageOrderValue,
        formattedValue: `$${averageOrderValue.toFixed(2)}`,
        iconName: "avg-order",
        changePercent: buildTrend(
          averageOrderSeries[6] ?? 0,
          averageOrderSeries[5] ?? 0,
          averageOrderSeries,
        ).changePercent,
        changeLabel,
        direction: buildTrend(
          averageOrderSeries[6] ?? 0,
          averageOrderSeries[5] ?? 0,
          averageOrderSeries,
        ).direction,
        series: averageOrderSeries,
      },
      {
        label: "Low Stock",
        value: lowStockProducts.length,
        formattedValue: String(lowStockProducts.length),
        iconName: "low-stock",
        changePercent: buildTrend(
          lowStockSeries[6] ?? lowStockProducts.length,
          lowStockSeries[5] ?? lowStockProducts.length,
          lowStockSeries,
        ).changePercent,
        changeLabel: "items",
        direction: buildTrend(
          lowStockSeries[6] ?? lowStockProducts.length,
          lowStockSeries[5] ?? lowStockProducts.length,
          lowStockSeries,
        ).direction,
        series: lowStockSeries,
        invertColor: true,
      },
      {
        label: "Cashiers",
        value: cashierPerformance.length,
        formattedValue: String(cashierPerformance.length),
        iconName: "customers",
        changePercent: 0,
        changeLabel: "active POS",
        direction: "flat" as const,
        series: [0, 0, 0, 0, 0, 0, 0],
      },
    ],
    revenueTimeline,
    paymentMethods: buildPaymentMethods(filteredOrders),
    topProducts: buildTopProducts(filteredOrders, categoryByProductId),
    posSummary,
    onlineSummary,
    cashierPerformance,
    posShifts,
    recentOrders: filteredOrders.slice(0, 10).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      source: order.source,
      customerName: order.customerName,
      time: order.createdAt,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      paymentMethod: formatPaymentMethodLabel(normalizePaymentMethod(order.paymentMethod)),
      paymentIconName: getPaymentIconName(order.paymentMethod),
      total: order.totalAmount,
      status: order.status,
    })),
    categoryBreakdown: buildCategoryBreakdown(filteredOrders, categoryByProductId),
    periodComparisons: await getPeriodComparisons(),
  };
}
