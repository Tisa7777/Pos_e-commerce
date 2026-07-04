import type { PremiumIconName } from "@/lib/premium-icons";

export type BuiltInUserRole = "admin" | "cashier" | "customer" | "clerk" | "manager";
export type UserRole = BuiltInUserRole | (string & {});
export type RoleAccessKind = "full" | "none" | "editable";
export interface RoleDefinition {
  role: UserRole;
  label: string;
  description: string;
  kind: RoleAccessKind;
  isSystem: boolean;
}
export type OrderStatus =
  | "draft"
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";
export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";
export type PaymentMethod =
  | "cash"
  | "card"
  | "qr"
  | "bank_transfer"
  | "cash_on_delivery";
export type InventoryMovementType =
  | "sale"
  | "restock"
  | "adjustment"
  | "return"
  | "initial_stock";
export type DiscountType = "percentage" | "fixed_amount";
export type SaleChannel = "pos" | "ecommerce";
export type EmployeeRole =
  | "admin"
  | "manager"
  | "cashier"
  | "inventory";
export type EmployeeStatus = "active" | "on_leave" | "inactive";
export type EmployeePayType = "salary" | "hourly" | "commission";

export interface ActionState<TData = undefined> {
  ok: boolean;
  message: string;
  data?: TData;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface NavItem {
  href: string;
  label: string;
  roles?: UserRole[];
}

export interface AppProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  roles: UserRole[];
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  productCount?: number;
  visualIcon?: string | null;
  accentColor?: string | null;
}

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  price: number;
  cost: number;
  stockQuantity: number;
  lowStockThreshold: number;
  category?: CategorySummary | null;
  supplierId?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  isActive: boolean;
}

export interface CustomerSummary {
  id: string;
  profileId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  loyaltyPoints?: number;
  notes?: string | null;
  visitCount?: number;
  totalSpent?: number;
  lastSeenAt?: string | null;
  discountPercent?: number;
  discountExpiresAt?: string | null;
  segment?: "vip" | "regular" | "walk-in" | "new";
  hasAccount?: boolean;
}

export interface CustomerAccount {
  profileId: string;
  customerId: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  loyaltyPoints: number;
  visitCount: number;
  totalSpent: number;
}

export interface SupplierSummary {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  productCount?: number;
  suppliedProducts?: Array<{
    id: string;
    name: string;
  }>;
}

export interface EmployeeSummary {
  id: string;
  profileId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: EmployeeRole;
  status: EmployeeStatus;
  payType: EmployeePayType;
  salaryAmount: number;
  hourlyRate: number;
  workDays: string[];
  shiftStart?: string | null;
  shiftEnd?: string | null;
  startDate?: string | null;
  emergencyContact?: string | null;
  address?: string | null;
  notes?: string | null;
  salesCount?: number;
  salesRevenue?: number;
  lastSaleAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl?: string | null;
}

export interface CartView {
  id: string;
  profileId: string;
  items: CartLine[];
  subtotal: number;
  discountAmount: number;
  total: number;
}

export interface OrderLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  channel: SaleChannel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  totalAmount: number;
  customerName?: string | null;
}

export interface CustomerOrderHistoryEntry {
  id: string;
  orderNumber: string;
  totalAmount: number;
  createdAt: string;
}

export interface PosSaleSnapshot {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  createdAt: string;
}

export interface PosCashierOption {
  id: string;
  name: string;
  profileId?: string | null;
  role?: EmployeeRole;
}

export type PosShiftStatus = "open" | "closed";

export interface PosShiftSummary {
  id: string;
  cashierProfileId?: string | null;
  cashierName: string;
  status: PosShiftStatus;
  openingCash: number;
  closingCash?: number | null;
  expectedCash?: number | null;
  cashDifference?: number | null;
  cashSalesAmount: number;
  cardSalesAmount: number;
  qrSalesAmount: number;
  totalSalesAmount: number;
  orderCount: number;
  openedAt: string;
  closedAt?: string | null;
  openedByName?: string | null;
  closedByName?: string | null;
  notes?: string | null;
}

export interface OrderDetail extends OrderSummary {
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  notes?: string | null;
  items: OrderLine[];
  cashierProfileId?: string | null;
  cashierName?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  paymentMethodLabel?: PaymentMethod | string | null;
}

export interface PublicOrderTracking {
  orderId: string;
  orderNumber: string;
  channel: SaleChannel;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  totalAmount: number;
  fulfillmentType: "pickup" | "delivery";
  customerMessage: string;
  itemCount: number;
  items: Array<{
    productName: string;
    quantity: number;
    lineTotal: number;
  }>;
}

export interface DashboardMetrics {
  revenueToday: number;
  ordersToday: number;
  averageOrderValue: number;
  lowStockCount: number;
}

export interface DailySalesRow {
  label: string;
  grossSales: number;
  orderCount: number;
}

export interface ReceiptData {
  order: OrderDetail;
  paymentMethod: PaymentMethod;
  cashierName?: string | null;
  cashReceived?: number | null;
  changeGiven?: number | null;
  displaySubtotal?: number | null;
  displayTax?: number | null;
  displayDiscount?: number | null;
  displayTotal?: number | null;
  taxRate?: number | null;
}

export interface InventoryMovementSummary {
  id: string;
  productId?: string;
  productName: string;
  productSku?: string | null;
  quantityDelta: number;
  movementType: InventoryMovementType;
  createdAt: string;
  reason?: string | null;
  actorName?: string | null;
}

export interface InventoryAdjustmentResult {
  productId: string;
  productName: string;
  quantityDelta: number;
  newStockQuantity: number;
  movementType: InventoryMovementType;
}

/* Analytics Dashboard */

export interface RevenueTimePoint {
  label: string;
  posRevenue: number;
  onlineRevenue: number;
  posOrders: number;
  onlineOrders: number;
}

export interface PaymentMethodDatum {
  method: string;
  iconName: PremiumIconName;
  totalPayments: number;
  totalAmount: number;
  posAmount: number;
  onlineAmount: number;
}

export interface TopProductDatum {
  id: string;
  name: string;
  iconName: PremiumIconName;
  unitsSold: number;
  revenue: number;
  channel: "pos" | "online" | "both";
}

export interface PosVsOnlineSummary {
  revenue: number;
  orders: number;
  avgOrder: number;
  topItem: string;
  peakHour: string;
  cashierName?: string;
}

export interface CategorySalesSplitDatum {
  label: string;
  iconName: PremiumIconName;
  posRevenue: number;
  onlineRevenue: number;
}

export interface CashierSalesDatum {
  cashierId: string;
  cashierName: string;
  orders: number;
  revenue: number;
  unitsSold: number;
  avgOrder: number;
  sharePercent: number;
  firstSaleAt?: string | null;
  lastSaleAt?: string | null;
  largestOrderTotal: number;
  largestOrderNumber?: string | null;
  topProductName?: string | null;
  topProductUnits: number;
}

export interface AnalyticsKpi {
  label: string;
  value: number;
  formattedValue: string;
  iconName: PremiumIconName;
  changePercent: number;
  changeLabel: string;
  direction: "up" | "down" | "flat";
  series: number[];
  invertColor?: boolean;
}

export interface AnalyticsRecentOrder {
  id: string;
  orderNumber: string;
  source: SaleChannel;
  customerName: string;
  time: string;
  itemCount: number;
  paymentMethod: string;
  paymentIconName: PremiumIconName;
  total: number;
  status: OrderStatus;
}

export interface PeriodComparisonMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  formattedCurrent: string;
  formattedPrevious: string;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export type PeriodComparisonSource = "all" | "pos" | "online";

export interface PeriodComparisonTopProduct {
  id: string;
  name: string;
  iconName: PremiumIconName;
  unitsSold: number;
  revenue: number;
  channel: "pos" | "online" | "both";
}

export interface PeriodComparisonProductMover {
  id: string;
  name: string;
  iconName: PremiumIconName;
  currentUnits: number;
  previousUnits: number;
  unitsDelta: number;
  currentRevenue: number;
  previousRevenue: number;
  revenueDelta: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
  channel: "pos" | "online" | "both";
}

export interface PeriodComparisonInsight {
  title: string;
  value: string;
  detail: string;
  tone: "positive" | "negative" | "neutral" | "warning";
  iconName: PremiumIconName;
}

export interface PeriodComparisonSegment {
  source: PeriodComparisonSource;
  sourceLabel: string;
  metrics: PeriodComparisonMetric[];
  currentDailyRevenue: number[];
  previousDailyRevenue: number[];
  currentRevenue: number;
  previousRevenue: number;
  currentOrders: number;
  previousOrders: number;
  currentUnits: number;
  previousUnits: number;
  topProducts: PeriodComparisonTopProduct[];
  productMovers: PeriodComparisonProductMover[];
  insights: PeriodComparisonInsight[];
}

export interface PeriodComparisonData {
  currentLabel: string;
  previousLabel: string;
  currentDateRange: string;
  previousDateRange: string;
  metrics: PeriodComparisonMetric[];
  /** Daily revenue for the bar chart: [previousPeriod[], currentPeriod[]] */
  currentDailyRevenue: number[];
  previousDailyRevenue: number[];
  dailyLabels: string[];
  segments: PeriodComparisonSegment[];
}

export interface AnalyticsDashboardData {
  lastUpdated: string;
  kpis: AnalyticsKpi[];
  revenueTimeline: RevenueTimePoint[];
  paymentMethods: PaymentMethodDatum[];
  topProducts: TopProductDatum[];
  posSummary: PosVsOnlineSummary;
  onlineSummary: PosVsOnlineSummary;
  recentOrders: AnalyticsRecentOrder[];
  categoryBreakdown: CategorySalesSplitDatum[];
  cashierPerformance: CashierSalesDatum[];
  posShifts: PosShiftSummary[];
  totalRevenue: number;
  totalOrders: number;
  periodComparisons: PeriodComparisonData[];
}
