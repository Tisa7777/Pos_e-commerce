import {
  isPostgresConfigured,
  isSupabaseConfigured,
  getSupabaseServiceRoleKey,
  requireBackendConfigured,
} from "@/lib/env";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import { isDrinkProduct } from "@/lib/catalog/drink-sizes";
import { parsePosReceiptMetadata, sortReceiptItemsBySequence } from "@/lib/pos/receipt-metadata";
import {
  attachSupabaseOrderToShift,
  ensurePostgresPosShiftSchema,
  findOpenPostgresShift,
  findOpenPosShiftForSale,
} from "@/lib/services/pos-shifts";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type {
  AppProfile,
  OrderDetail,
  PaymentMethod,
  PublicOrderTracking,
  ReceiptData,
  UserRole,
} from "@/types/domain";

interface RawOrderItemRecord {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number | string;
  discount_amount: number | string;
  line_total: number | string;
}

interface RawOrderRecord {
  id: string;
  order_number: string;
  channel: "pos" | "ecommerce";
  status: OrderDetail["status"];
  payment_status: OrderDetail["paymentStatus"];
  created_at: string;
  total_amount: number | string;
  subtotal_amount: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  shipping_amount: number | string;
  notes?: string | null;
  profile_id?: string | null;
  cashier_profile_id?: string | null;
  customers?: {
    full_name?: string | null;
  } | null;
  order_items?: RawOrderItemRecord[] | null;
}

interface PostgresOrderRecord {
  id: string;
  order_number: string;
  channel: "pos" | "ecommerce";
  status: OrderDetail["status"];
  payment_status: OrderDetail["paymentStatus"];
  created_at: string;
  total_amount: number | string;
  subtotal_amount: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  shipping_amount: number | string;
  notes?: string | null;
  profile_id?: string | null;
  customer_name?: string | null;
  cashier_profile_id?: string | null;
  cashier_name?: string | null;
}

interface PostgresOrderItemRecord extends RawOrderItemRecord {
  order_id: string;
}

interface RawPaymentRecord {
  order_id: string;
  method: PaymentMethod;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface PostgresSchemaCapabilities {
  orderItemsHasUnitCost: boolean;
  inventoryMovementsHasOrderItemId: boolean;
  hasPayments: boolean;
  hasAuditLogs: boolean;
}

interface CompletePosSaleInput {
  customerId?: string;
  customerName?: string;
  discountAmount: number;
  paymentMethod: "cash" | "card" | "qr" | "bank_transfer";
  notes?: string;
  items: Array<{ productId: string; quantity: number; productName?: string; sku?: string; unitPrice?: number }>;
  cashierName?: string;
  cashierProfileId?: string;
  posShiftId?: string;
  displaySubtotal?: number;
  displayTax?: number;
  displayTotal?: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function calculatePosSaleTotals(input: CompletePosSaleInput) {
  const subtotal = roundMoney(
    input.displaySubtotal ??
      input.items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0),
  );
  const tax = roundMoney(input.displayTax ?? subtotal * 0.1);
  const discount = roundMoney(Math.min(input.discountAmount, subtotal + tax));
  const total = roundMoney(input.displayTotal ?? Math.max(subtotal + tax - discount, 0));

  return {
    subtotal,
    tax,
    discount,
    total,
  };
}

function getCashierNameFromRawOrder(
  record: RawOrderRecord,
  receiptMetadata: ReturnType<typeof parsePosReceiptMetadata> | null,
  cashierNameById?: Map<string, string>,
) {
  if (record.channel !== "pos") {
    return null;
  }

  return (
    receiptMetadata?.cashierName ??
    (record.cashier_profile_id ? cashierNameById?.get(record.cashier_profile_id) : null) ??
    null
  );
}

function getCashierNameFromPostgresOrder(
  record: PostgresOrderRecord,
  receiptMetadata: ReturnType<typeof parsePosReceiptMetadata> | null,
) {
  if (record.channel !== "pos") {
    return null;
  }

  return receiptMetadata?.cashierName ?? record.cashier_name ?? null;
}

async function loadSupabaseCashierNameMap(
  supabase: SupabaseServerClient,
  cashierProfileIds: Array<string | null | undefined>,
) {
  const ids = Array.from(new Set(cashierProfileIds.filter((id): id is string => Boolean(id))));
  const cashierNameById = new Map<string, string>();

  if (ids.length === 0) {
    return cashierNameById;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);

  for (const profile of (data ?? []) as Array<{
    id: string;
    full_name?: string | null;
    email?: string | null;
  }>) {
    cashierNameById.set(profile.id, profile.full_name ?? profile.email ?? "Cashier");
  }

  return cashierNameById;
}

function mapOrder(
  record: RawOrderRecord,
  cashierNameById?: Map<string, string>,
): OrderDetail {
  const receiptMetadata =
    record.channel === "pos" ? parsePosReceiptMetadata(record.notes) : null;
  const subtotalAmount = receiptMetadata?.displaySubtotal ?? Number(record.subtotal_amount);
  const discountAmount = receiptMetadata?.displayDiscount ?? Number(record.discount_amount);
  const taxAmount = receiptMetadata?.displayTax ?? Number(record.tax_amount);
  const totalAmount = receiptMetadata?.displayTotal ?? Number(record.total_amount);

  return {
    id: record.id,
    orderNumber: record.order_number,
    channel: record.channel,
    status: record.status,
    paymentStatus: record.payment_status,
    createdAt: record.created_at,
    totalAmount,
    subtotalAmount,
    discountAmount,
    taxAmount,
    shippingAmount: Number(record.shipping_amount),
    customerName: record.customers?.full_name ?? null,
    notes: record.channel === "pos" ? receiptMetadata?.noteText : record.notes,
    cashierProfileId: record.cashier_profile_id ?? null,
    cashierName: getCashierNameFromRawOrder(record, receiptMetadata, cashierNameById),
    items:
      record.order_items?.map((item) => ({
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
}

function mapPostgresOrder(
  record: PostgresOrderRecord,
  items: PostgresOrderItemRecord[] = [],
): OrderDetail {
  const receiptMetadata =
    record.channel === "pos" ? parsePosReceiptMetadata(record.notes) : null;
  const subtotalAmount = receiptMetadata?.displaySubtotal ?? Number(record.subtotal_amount);
  const discountAmount = receiptMetadata?.displayDiscount ?? Number(record.discount_amount);
  const taxAmount = receiptMetadata?.displayTax ?? Number(record.tax_amount);
  const totalAmount = receiptMetadata?.displayTotal ?? Number(record.total_amount);

  return {
    id: record.id,
    orderNumber: record.order_number,
    channel: record.channel,
    status: record.status,
    paymentStatus: record.payment_status,
    createdAt: record.created_at,
    totalAmount,
    subtotalAmount,
    discountAmount,
    taxAmount,
    shippingAmount: Number(record.shipping_amount),
    customerName: record.customer_name ?? null,
    notes: record.channel === "pos" ? receiptMetadata?.noteText : record.notes,
    cashierProfileId: record.cashier_profile_id ?? null,
    cashierName: getCashierNameFromPostgresOrder(record, receiptMetadata),
    items: items.map((item) => ({
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
}

function postgresOrderToRawRecord(record: PostgresOrderRecord, items: PostgresOrderItemRecord[]): RawOrderRecord {
  return {
    id: record.id,
    order_number: record.order_number,
    channel: record.channel,
    status: record.status,
    payment_status: record.payment_status,
    created_at: record.created_at,
    total_amount: record.total_amount,
    subtotal_amount: record.subtotal_amount,
    discount_amount: record.discount_amount,
    tax_amount: record.tax_amount,
    shipping_amount: record.shipping_amount,
    notes: record.notes,
    profile_id: record.profile_id,
    cashier_profile_id: record.cashier_profile_id,
    customers: record.customer_name ? { full_name: record.customer_name } : null,
    order_items: items,
  };
}

function mapPublicOrderTracking(order: OrderDetail): PublicOrderTracking {
  const fulfillmentType = order.notes?.toLowerCase().includes("delivery to:")
    ? "delivery"
    : "pickup";
  const customerMessage = getPublicOrderCustomerMessage(order.status, fulfillmentType);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    totalAmount: order.totalAmount,
    fulfillmentType,
    customerMessage,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  };
}

function getPublicOrderCustomerMessage(
  status: OrderDetail["status"],
  fulfillmentType: "pickup" | "delivery",
) {
  if (status === "completed") {
    return fulfillmentType === "delivery"
      ? "Your order is ready and our delivery staff is on the way."
      : "Your order is ready. Please pick it up at the shop.";
  }

  if (status === "processing" || status === "paid") {
    return "Your order is being prepared now.";
  }

  if (status === "cancelled") {
    return "This order was cancelled. Please contact the shop if you need help.";
  }

  return "We received your order and will start preparing it soon.";
}

async function createOrderLookupSupabaseClient() {
  if (getSupabaseServiceRoleKey()) {
    return createSupabaseServiceRoleClient();
  }

  return createSupabaseServerClient();
}

async function loadPostgresOrderItems(orderIds: string[]) {
  if (orderIds.length === 0) {
    return new Map<string, PostgresOrderItemRecord[]>();
  }

  const { rows } = await dbQuery<PostgresOrderItemRecord>(
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
      order by created_at asc
    `,
    [orderIds],
  );

  const itemMap = new Map<string, PostgresOrderItemRecord[]>();
  for (const item of rows) {
    const existing = itemMap.get(item.order_id) ?? [];
    existing.push(item);
    itemMap.set(item.order_id, existing);
  }

  return itemMap;
}

async function getPostgresSchemaCapabilities(
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ table_name: string; column_name: string }> }>,
): Promise<PostgresSchemaCapabilities> {
  const { rows } = await query(
    `
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('order_items', 'inventory_movements', 'payments', 'audit_logs')
    `,
  );

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of rows) {
    const columns = columnsByTable.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    columnsByTable.set(row.table_name, columns);
  }

  return {
    orderItemsHasUnitCost: columnsByTable.get("order_items")?.has("unit_cost") ?? false,
    inventoryMovementsHasOrderItemId:
      columnsByTable.get("inventory_movements")?.has("order_item_id") ?? false,
    hasPayments: columnsByTable.has("payments"),
    hasAuditLogs: columnsByTable.has("audit_logs"),
  };
}

async function loadPostgresLatestPayments(orderIds: string[]) {
  const paymentMap = new Map<string, RawPaymentRecord>();
  if (orderIds.length === 0) {
    return paymentMap;
  }

  const capabilities = await getPostgresSchemaCapabilities((text, params = []) =>
    dbQuery<{ table_name: string; column_name: string }>(text, params),
  );

  if (!capabilities.hasPayments) {
    return paymentMap;
  }

  const { rows } = await dbQuery<RawPaymentRecord>(
    `
      select order_id, method, metadata, created_at
      from public.payments
      where order_id = any($1::uuid[])
      order by created_at desc
    `,
    [orderIds],
  );

  for (const payment of rows) {
    if (!paymentMap.has(payment.order_id)) {
      paymentMap.set(payment.order_id, payment);
    }
  }

  return paymentMap;
}

function buildReceiptData(
  orderRecord: RawOrderRecord,
  paymentRecord?: RawPaymentRecord | null,
): ReceiptData {
  const order = mapOrder(orderRecord);
  const metadata = parsePosReceiptMetadata(orderRecord.notes);
  const displaySubtotal = metadata.displaySubtotal ?? order.subtotalAmount;
  const displayTax = metadata.displayTax ?? order.taxAmount;
  const displayDiscount = metadata.displayDiscount ?? order.discountAmount;
  const displayTotal = metadata.displayTotal ?? order.totalAmount;
  const paymentMethod = paymentRecord?.method ?? "cash";
  const cashReceived =
    metadata.cashReceived ?? (paymentMethod === "cash" ? displayTotal : null);
  const changeGiven =
    metadata.changeGiven ??
    (paymentMethod === "cash" && cashReceived !== null
      ? Math.max(cashReceived - displayTotal, 0)
      : null);

  return {
    order: {
      ...order,
      notes: metadata.noteText,
      items: sortReceiptItemsBySequence(order.items, metadata.itemSequence),
    },
    paymentMethod,
    cashierName: metadata.cashierName ?? "Cashier",
    cashReceived,
    changeGiven,
    displaySubtotal,
    displayTax,
    displayDiscount,
    displayTotal,
    taxRate: metadata.taxRate ?? null,
  };
}

export async function listOrders(options: {
  profileId?: string;
  roles?: UserRole[];
  channel?: "pos" | "ecommerce";
  limit?: number;
} = {}) {
  if (isPostgresConfigured()) {
    const params: unknown[] = [];
    const conditions: string[] = [];
    const isStaff = options.roles?.some((role) => role !== "customer");

    if (!isStaff) {
      if (!options.profileId) {
        return [];
      }

      params.push(options.profileId);
      conditions.push(`o.profile_id = $${params.length}`);
    }

    if (options.channel) {
      params.push(options.channel);
      conditions.push(`o.channel = $${params.length}`);
    }

    const limit = options.limit ?? 50;
    params.push(limit);

    const { rows: orders } = await dbQuery<PostgresOrderRecord>(
      `
        select
          o.id,
          o.order_number,
          o.channel,
          o.status,
          o.payment_status,
          o.created_at,
          o.total_amount,
          o.subtotal_amount,
          o.discount_amount,
          o.tax_amount,
          o.shipping_amount,
          o.notes,
          o.profile_id,
          o.cashier_profile_id,
          c.full_name as customer_name,
          cashier.full_name as cashier_name
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        left join public.profiles cashier on cashier.id = o.cashier_profile_id
        ${conditions.length > 0 ? `where ${conditions.join(" and ")}` : ""}
        order by o.created_at desc
        limit $${params.length}
      `,
      params,
    );

    const itemMap = await loadPostgresOrderItems(orders.map((order) => order.id));
    return orders.map((order) => mapPostgresOrder(order, itemMap.get(order.id) ?? []));
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("orders")
    .select("*, customers(full_name), order_items(*)")
    .order("created_at", { ascending: false });

  const isStaff = options.roles?.some((role) => role !== "customer");

  if (!isStaff && options.profileId) {
    request = request.eq("profile_id", options.profileId);
  }

  if (options.channel) {
    request = request.eq("channel", options.channel);
  }

  if (options.limit) {
    request = request.limit(options.limit);
  }

  const { data } = await request;
  const orderRecords = (data ?? []) as RawOrderRecord[];
  const cashierNameById = await loadSupabaseCashierNameMap(
    supabase,
    orderRecords.map((order) => order.cashier_profile_id),
  );

  return orderRecords.map((order) => mapOrder(order, cashierNameById));
}

export async function getOrderById(id: string, profile?: AppProfile | null) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<PostgresOrderRecord>(
      `
        select
          o.id,
          o.order_number,
          o.channel,
          o.status,
          o.payment_status,
          o.created_at,
          o.total_amount,
          o.subtotal_amount,
          o.discount_amount,
          o.tax_amount,
          o.shipping_amount,
          o.notes,
          o.profile_id,
          o.cashier_profile_id,
          c.full_name as customer_name,
          cashier.full_name as cashier_name
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        left join public.profiles cashier on cashier.id = o.cashier_profile_id
        where o.id = $1
        limit 1
      `,
      [id],
    );

    const order = rows[0];
    if (!order) {
      return null;
    }

    if (
      profile &&
      profile.roles.includes("customer") &&
      !profile.roles.some((role) => role !== "customer") &&
      order.profile_id !== profile.id
    ) {
      return null;
    }

    const itemMap = await loadPostgresOrderItems([id]);
    return mapPostgresOrder(order, itemMap.get(id) ?? []);
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*, customers(full_name), order_items(*)")
    .eq("id", id)
    .single();

  if (!data) {
    return null;
  }

  const orderRecord = data as RawOrderRecord;
  const cashierNameById = await loadSupabaseCashierNameMap(
    supabase,
    [orderRecord.cashier_profile_id],
  );
  const mapped = mapOrder(orderRecord, cashierNameById);

  if (
    profile &&
    profile.roles.includes("customer") &&
    !profile.roles.some((role) => role !== "customer") &&
    data.profile_id !== profile.id
  ) {
    return null;
  }

  return mapped;
}

export async function getPublicOrderTrackingByNumber(orderNumber: string) {
  const normalizedOrderNumber = orderNumber.trim().toUpperCase();

  if (!normalizedOrderNumber) {
    return null;
  }

  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<PostgresOrderRecord>(
      `
        select
          o.id,
          o.order_number,
          o.channel,
          o.status,
          o.payment_status,
          o.created_at,
          o.total_amount,
          o.subtotal_amount,
          o.discount_amount,
          o.tax_amount,
          o.shipping_amount,
          o.notes,
          o.profile_id,
          c.full_name as customer_name
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        where upper(o.order_number) = $1
        limit 1
      `,
      [normalizedOrderNumber],
    );

    const order = rows[0];
    if (!order) {
      return null;
    }

    const itemMap = await loadPostgresOrderItems([order.id]);
    return mapPublicOrderTracking(mapPostgresOrder(order, itemMap.get(order.id) ?? []));
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createOrderLookupSupabaseClient();
  const { data } = await supabase
    .from("orders")
    .select("*, customers(full_name), order_items(*)")
    .eq("order_number", normalizedOrderNumber)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return mapPublicOrderTracking(mapOrder(data as RawOrderRecord));
}

export async function listPosHistoryReceipts() {
  if (isPostgresConfigured()) {
    const { rows: orders } = await dbQuery<PostgresOrderRecord>(
      `
        select
          o.id,
          o.order_number,
          o.channel,
          o.status,
          o.payment_status,
          o.created_at,
          o.total_amount,
          o.subtotal_amount,
          o.discount_amount,
          o.tax_amount,
          o.shipping_amount,
          o.notes,
          o.profile_id,
          c.full_name as customer_name
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        where o.channel in ('pos', 'ecommerce')
        order by o.created_at desc
      `,
    );

    const itemMap = await loadPostgresOrderItems(orders.map((order) => order.id));
    const paymentMap = await loadPostgresLatestPayments(orders.map((order) => order.id));
    return orders.map((order) =>
      buildReceiptData(
        postgresOrderToRawRecord(order, itemMap.get(order.id) ?? []),
        paymentMap.get(order.id),
      ),
    );
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, customers(full_name), order_items(*)")
    .in("channel", ["pos", "ecommerce"])
    .order("created_at", { ascending: false });

  const orderRecords = (orders ?? []) as RawOrderRecord[];
  if (orderRecords.length === 0) {
    return [];
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("order_id, method, metadata, created_at")
    .in(
      "order_id",
      orderRecords.map((order) => order.id),
    )
    .order("created_at", { ascending: false });

  const latestPaymentByOrder = new Map<string, RawPaymentRecord>();
  for (const payment of (payments ?? []) as RawPaymentRecord[]) {
    if (!latestPaymentByOrder.has(payment.order_id)) {
      latestPaymentByOrder.set(payment.order_id, payment);
    }
  }

  return orderRecords.map((order) => buildReceiptData(order, latestPaymentByOrder.get(order.id)));
}

export async function completePosSale(profile: AppProfile, input: CompletePosSaleInput) {
  const totals = calculatePosSaleTotals(input);

  if (isPostgresConfigured()) {
    return withDbTransaction(async (client) => {
      const capabilities = await getPostgresSchemaCapabilities((text, params = []) =>
        client.query(text, params),
      );
      const cashierProfileId = input.cashierProfileId || profile.id;
      await ensurePostgresPosShiftSchema((text, params = []) => client.query(text, params)).catch(() => {});
      const activeShift = await findOpenPostgresShift(
        (text, params = []) => client.query(text, params),
        {
          shiftId: input.posShiftId,
          cashierProfileId: input.cashierProfileId || null,
          cashierName: input.cashierName ?? profile.fullName,
        },
      ).catch(() => null);

      const shiftColumns = activeShift ? ",\n            pos_shift_id" : "";
      const shiftPlaceholder = activeShift ? ", $3" : "";
      const shiftParams = activeShift ? [activeShift.id] : [];
      const baseParamOffset = activeShift ? 4 : 3;

      const orderResult = await client.query<{ id: string }>(
        `
          insert into public.orders (
            customer_id,
            profile_id,
            cashier_profile_id${shiftColumns},
            channel,
            status,
            payment_status,
            subtotal_amount,
            discount_amount,
            tax_amount,
            shipping_amount,
            total_amount,
            notes
          )
          values ($1, null, $2${shiftPlaceholder}, 'pos', 'completed', 'paid', $${baseParamOffset}, $${baseParamOffset + 1}, $${baseParamOffset + 2}, 0, $${baseParamOffset + 3}, $${baseParamOffset + 4})
          returning id
        `,
        [
          input.customerId || null,
          cashierProfileId,
          ...shiftParams,
          totals.subtotal,
          totals.discount,
          totals.tax,
          totals.total,
          input.notes ?? null,
        ],
      );

      const orderId = orderResult.rows[0]?.id;
      if (!orderId) {
        throw new Error("Unable to create POS sale.");
      }

      for (const item of input.items) {
        const productResult = await client.query<{
          id: string;
          name: string;
          sku: string;
          price: number | string;
          cost: number | string;
          stock_quantity: number;
          category_name: string | null;
          category_slug: string | null;
        }>(
          `
            select
              p.id,
              p.name,
              p.sku,
              p.price,
              p.cost,
              p.stock_quantity,
              c.name as category_name,
              c.slug as category_slug
            from public.products p
            left join public.categories c on c.id = p.category_id
            where p.id = $1
              and p.is_active = true
              and p.deleted_at is null
            for update of p
          `,
          [item.productId],
        );

        const product = productResult.rows[0];
        if (!product) {
          throw new Error(`Product not found: ${item.productName ?? item.productId}`);
        }

        const isStockTracked = !isDrinkProduct({
          category: {
            name: product.category_name,
            slug: product.category_slug,
          },
        });

        if (isStockTracked && product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}.`);
        }

        const unitPrice = item.unitPrice ?? Number(product.price);
        const lineTotal = unitPrice * item.quantity;
        const orderItemResult = capabilities.orderItemsHasUnitCost
          ? await client.query<{ id: string }>(
              `
            insert into public.order_items (
              order_id,
              product_id,
              product_name,
              sku,
              quantity,
              unit_price,
              unit_cost,
              discount_amount,
              line_total
            )
            values ($1, $2, $3, $4, $5, $6, $7, 0, $8)
            returning id
          `,
              [
                orderId,
                product.id,
                item.productName ?? product.name,
                item.sku ?? product.sku,
                item.quantity,
                unitPrice,
                Number(product.cost),
                lineTotal,
              ],
            )
          : await client.query<{ id: string }>(
              `
            insert into public.order_items (
              order_id,
              product_id,
              product_name,
              sku,
              quantity,
              unit_price,
              discount_amount,
              line_total
            )
            values ($1, $2, $3, $4, $5, $6, 0, $7)
            returning id
          `,
              [
                orderId,
                product.id,
                item.productName ?? product.name,
                item.sku ?? product.sku,
                item.quantity,
                unitPrice,
                lineTotal,
              ],
            );

        if (isStockTracked) {
          await client.query(
            `
              update public.products
              set stock_quantity = stock_quantity - $1,
                  updated_at = timezone('utc', now())
              where id = $2
            `,
            [item.quantity, product.id],
          );

          if (capabilities.inventoryMovementsHasOrderItemId) {
            await client.query(
              `
                insert into public.inventory_movements (
                  product_id,
                  order_id,
                  order_item_id,
                  actor_profile_id,
                  movement_type,
                  quantity_delta,
                  reason
                )
                values ($1, $2, $3, $4, 'sale', $5, $6)
              `,
              [
                product.id,
                orderId,
                orderItemResult.rows[0]?.id ?? null,
                profile.id,
                -item.quantity,
                `POS sale (${orderId})`,
              ],
            );
          } else {
            await client.query(
            `
              insert into public.inventory_movements (
                product_id,
                order_id,
                actor_profile_id,
                movement_type,
                quantity_delta,
                reason
              )
              values ($1, $2, $3, 'sale', $4, $5)
            `,
              [product.id, orderId, profile.id, -item.quantity, `POS sale (${orderId})`],
            );
          }
        }
      }

      if (capabilities.hasPayments) {
        await client.query(
          `
            insert into public.payments (
              order_id,
              method,
              status,
              amount,
              paid_at,
              metadata
            )
            values ($1, $2, 'paid', $3, timezone('utc', now()), $4::jsonb)
          `,
          [
            orderId,
            input.paymentMethod,
            totals.total,
            JSON.stringify({
              channel: "pos",
              shiftId: activeShift?.id ?? null,
              cashierName: input.cashierName ?? profile.fullName,
              cashReceived: input.cashReceived ?? null,
              changeGiven: input.changeGiven ?? null,
            }),
          ],
        );
      }

      if (capabilities.hasAuditLogs) {
        await client.query(
          `
            insert into public.audit_logs (
              actor_profile_id,
              entity_type,
              entity_id,
              action,
              before_data,
              after_data
            )
            values ($1, 'orders', $2, 'created', null, $3::jsonb)
          `,
          [
            profile.id,
            orderId,
            JSON.stringify({
              channel: "pos",
              total_amount: totals.total,
              payment_method: input.paymentMethod,
            }),
          ],
        );
      }

      return orderId;
    });
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("POS checkout");
  }

  const activeShift = await findOpenPosShiftForSale({
    shiftId: input.posShiftId,
    cashierProfileId: input.cashierProfileId || null,
    cashierName: input.cashierName ?? profile.fullName,
  }).catch(() => null);

  const serviceSupabase = createSupabaseServiceRoleClient();
  const { data: orderRow, error: orderError } = await serviceSupabase
    .from("orders")
    .insert({
      channel: "pos",
      profile_id: null,
      customer_id: input.customerId || null,
      cashier_profile_id: input.cashierProfileId || profile.id,
      ...(activeShift ? { pos_shift_id: activeShift.id } : {}),
      status: "completed",
      payment_status: "paid",
      subtotal_amount: totals.subtotal,
      discount_amount: totals.discount,
      tax_amount: totals.tax,
      shipping_amount: 0,
      total_amount: totals.total,
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (orderError || !orderRow) {
    throw new Error(orderError?.message ?? "Unable to create POS sale.");
  }

  const orderId = orderRow.id as string;

  for (const item of input.items) {
    const { data: product, error: productError } = await serviceSupabase
      .from("products")
      .select("id, name, sku, price, cost, stock_quantity, categories(name, slug)")
      .eq("id", item.productId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (productError || !product) {
      throw new Error(`Product not found: ${item.productName ?? item.productId}`);
    }

    const productCategory = Array.isArray(product.categories)
      ? product.categories[0]
      : product.categories;
    const isStockTracked = !isDrinkProduct({ category: productCategory });

    if (isStockTracked && Number(product.stock_quantity) < item.quantity) {
      throw new Error(`Insufficient stock for product ${product.name}.`);
    }

    const unitPrice = item.unitPrice ?? Number(product.price);
    const lineTotal = unitPrice * item.quantity;
    const { data: orderItem, error: orderItemError } = await serviceSupabase
      .from("order_items")
      .insert({
        order_id: orderId,
        product_id: product.id,
        product_name: item.productName ?? product.name,
        sku: item.sku ?? product.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
        unit_cost: Number(product.cost),
        discount_amount: 0,
        line_total: lineTotal,
      })
      .select("id")
      .single();

    if (orderItemError || !orderItem) {
      throw new Error(orderItemError?.message ?? "Unable to add POS sale item.");
    }

    if (isStockTracked) {
      const { error: stockError } = await serviceSupabase
        .from("products")
        .update({ stock_quantity: Number(product.stock_quantity) - item.quantity })
        .eq("id", product.id);

      if (stockError) {
        throw new Error(stockError.message);
      }

      const { error: movementError } = await serviceSupabase.from("inventory_movements").insert({
        product_id: product.id,
        order_id: orderId,
        order_item_id: orderItem.id,
        actor_profile_id: input.cashierProfileId || profile.id,
        movement_type: "sale",
        quantity_delta: -item.quantity,
        reason: "POS sale completed",
      });

      if (movementError) {
        throw new Error(movementError.message);
      }
    }
  }

  const { error: paymentError } = await serviceSupabase.from("payments").insert({
    order_id: orderId,
    method: input.paymentMethod,
    status: "paid",
    amount: totals.total,
    paid_at: new Date().toISOString(),
    metadata: {
      channel: "pos",
      shiftId: activeShift?.id ?? null,
      cashierName: input.cashierName ?? profile.fullName,
      paymentMethod: input.paymentMethod,
      cashReceived: input.cashReceived ?? null,
      changeGiven: input.changeGiven ?? null,
    },
  });

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  if (activeShift) {
    await attachSupabaseOrderToShift({
      orderId,
      shiftId: activeShift.id,
    });
  }

  return orderId;
}

export async function getReceipt(orderId: string): Promise<ReceiptData | null> {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<PostgresOrderRecord>(
      `
        select
          o.id,
          o.order_number,
          o.channel,
          o.status,
          o.payment_status,
          o.created_at,
          o.total_amount,
          o.subtotal_amount,
          o.discount_amount,
          o.tax_amount,
          o.shipping_amount,
          o.notes,
          o.profile_id,
          c.full_name as customer_name
        from public.orders o
        left join public.customers c on c.id = o.customer_id
        where o.id = $1
        limit 1
      `,
      [orderId],
    );

    const order = rows[0];
    if (!order) {
      return null;
    }

    const itemMap = await loadPostgresOrderItems([orderId]);
    const paymentMap = await loadPostgresLatestPayments([orderId]);
    return buildReceiptData(
      postgresOrderToRawRecord(order, itemMap.get(orderId) ?? []),
      paymentMap.get(orderId),
    );
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: order }, { data: payment }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, customers(full_name), order_items(*)")
      .eq("id", orderId)
      .single(),
    supabase
      .from("payments")
      .select("order_id, method, metadata, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!order) {
    return null;
  }

  return buildReceiptData(order as RawOrderRecord, (payment as RawPaymentRecord | null) ?? null);
}
