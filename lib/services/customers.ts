import {
  isPostgresConfigured,
  isSupabaseConfigured,
  requireBackendConfigured,
} from "@/lib/env";
import {
  parseCustomerMetadata,
  serializeCustomerMetadata,
} from "@/lib/crm/customer-metadata";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { listCustomers } from "@/lib/services/products";
import type { CustomerAccount, CustomerOrderHistoryEntry, CustomerSummary } from "@/types/domain";

export async function listCustomerOrderHistory(
  customerId: string,
  limit = 6,
): Promise<CustomerOrderHistoryEntry[]> {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{
      id: string;
      order_number: string;
      total_amount: number | string;
      created_at: string;
    }>(
      `
        select id, order_number, total_amount, created_at
        from public.orders
        where customer_id = $1
          and status not in ('cancelled', 'refunded')
        order by created_at desc
        limit $2
      `,
      [customerId, limit],
    );

    return rows.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      totalAmount: Number(order.total_amount),
      createdAt: order.created_at,
    }));
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, created_at, status")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    order_number: string;
    total_amount: number | string;
    created_at: string;
    status: string;
  }>)
    .filter((order) => !["cancelled", "refunded"].includes(order.status))
    .map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      totalAmount: Number(order.total_amount),
      createdAt: order.created_at,
    }));
}

export async function createCustomer(input: {
  fullName: string;
  email?: string;
  phone?: string;
  loyaltyPoints?: number;
  notes?: string;
  discountPercent?: number;
  discountExpiresAt?: string | null;
}) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ id: string }>(
      `
        insert into public.customers (
          full_name,
          email,
          phone,
          notes,
          loyalty_points,
          is_active
        )
        values ($1, $2, $3, $4, $5, true)
        returning id
      `,
      [
        input.fullName,
        input.email || null,
        input.phone || null,
        serializeCustomerMetadata({
          notes: input.notes,
          discountPercent: input.discountPercent,
          discountExpiresAt: input.discountExpiresAt ?? null,
        }),
        input.loyaltyPoints ?? 0,
      ],
    );

    const customers = await listCustomers();
    return customers.find((customer) => customer.id === rows[0]?.id) ?? null;
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Customer creation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      full_name: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      notes: serializeCustomerMetadata({
        notes: input.notes,
        discountPercent: input.discountPercent,
        discountExpiresAt: input.discountExpiresAt ?? null,
      }),
      loyalty_points: input.loyaltyPoints ?? 0,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const customers = await listCustomers();
  return customers.find((customer) => customer.id === data.id) ?? null;
}

export async function updateCustomer(input: {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  loyaltyPoints?: number;
  notes?: string;
  discountPercent?: number;
  discountExpiresAt?: string | null;
}) {
  if (isPostgresConfigured()) {
    await dbQuery(
      `
        update public.customers
        set full_name = $1,
            email = $2,
            phone = $3,
            notes = $4,
            loyalty_points = $5
        where id = $6
      `,
      [
        input.fullName,
        input.email || null,
        input.phone || null,
        serializeCustomerMetadata({
          notes: input.notes,
          discountPercent: input.discountPercent,
          discountExpiresAt: input.discountExpiresAt ?? null,
        }),
        input.loyaltyPoints ?? 0,
        input.id,
      ],
    );

    const customers = await listCustomers();
    return customers.find((customer) => customer.id === input.id) ?? null;
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Customer updates");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .update({
      full_name: input.fullName,
      email: input.email || null,
      phone: input.phone || null,
      notes: serializeCustomerMetadata({
        notes: input.notes,
        discountPercent: input.discountPercent,
        discountExpiresAt: input.discountExpiresAt ?? null,
      }),
      loyalty_points: input.loyaltyPoints ?? 0,
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }

  const customers = await listCustomers();
  return customers.find((customer) => customer.id === input.id) ?? null;
}

export async function addCustomerLoyaltyPoints(input: {
  id: string;
  pointsToAdd: number;
}) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ loyalty_points: number }>(
      `
        update public.customers
        set loyalty_points = loyalty_points + $1
        where id = $2
        returning loyalty_points
      `,
      [input.pointsToAdd, input.id],
    );

    await dbQuery(
      `
        insert into public.loyalty_transactions (
          customer_id,
          transaction_type,
          points_delta,
          balance_after,
          description
        )
        values ($1, 'adjusted', $2, $3, 'Manual loyalty point adjustment')
      `,
      [input.id, input.pointsToAdd, rows[0]?.loyalty_points ?? null],
    );

    const customers = await listCustomers();
    return customers.find((customer) => customer.id === input.id) ?? null;
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Customer loyalty updates");
  }

  const supabase = await createSupabaseServerClient();
  const { data: currentCustomer, error: currentError } = await supabase
    .from("customers")
    .select("id, loyalty_points")
    .eq("id", input.id)
    .single();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const { error } = await supabase
    .from("customers")
    .update({
      loyalty_points: (currentCustomer?.loyalty_points ?? 0) + input.pointsToAdd,
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }

  const balanceAfter = (currentCustomer?.loyalty_points ?? 0) + input.pointsToAdd;
  const { error: transactionError } = await supabase.from("loyalty_transactions").insert({
    customer_id: input.id,
    transaction_type: "adjusted",
    points_delta: input.pointsToAdd,
    balance_after: balanceAfter,
    description: "Manual loyalty point adjustment",
  });

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const customers = await listCustomers();
  return customers.find((customer) => customer.id === input.id) ?? null;
}

export async function saveCustomerDiscount(input: {
  id: string;
  notes?: string;
  discountPercent: number;
  discountExpiresAt?: string | null;
}) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ notes: string | null }>(
      `
        select notes
        from public.customers
        where id = $1
        limit 1
      `,
      [input.id],
    );

    const currentMetadata = parseCustomerMetadata(rows[0]?.notes ?? null);
    const notes = input.notes ?? currentMetadata.notes ?? undefined;

    await dbQuery(
      `
        update public.customers
        set notes = $1
        where id = $2
      `,
      [
        serializeCustomerMetadata({
          notes,
          discountPercent: input.discountPercent,
          discountExpiresAt: input.discountExpiresAt ?? null,
        }),
        input.id,
      ],
    );

    const customers = await listCustomers();
    return customers.find((customer) => customer.id === input.id) ?? null;
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Customer discounts");
  }

  const supabase = await createSupabaseServerClient();
  const { data: currentCustomer, error: currentError } = await supabase
    .from("customers")
    .select("notes")
    .eq("id", input.id)
    .single();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const currentMetadata = parseCustomerMetadata(currentCustomer?.notes ?? null);
  const notes = input.notes ?? currentMetadata.notes ?? undefined;

  const { error } = await supabase
    .from("customers")
    .update({
      notes: serializeCustomerMetadata({
        notes,
        discountPercent: input.discountPercent,
        discountExpiresAt: input.discountExpiresAt ?? null,
      }),
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }

  const customers = await listCustomers();
  return customers.find((customer) => customer.id === input.id) ?? null;
}

export async function deleteCustomer(customerId: string) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ order_count: string | number }>(
      `
        select count(*) as order_count
        from public.orders
        where customer_id = $1
      `,
      [customerId],
    );

    await dbQuery(
      `
        update public.customers
        set is_active = false
        where id = $1
      `,
      [customerId],
    );

    return {
      id: customerId,
      orderCount: Number(rows[0]?.order_count ?? 0),
    };
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Customer deletion");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId);

  const { data, error } = await supabase
    .from("customers")
    .update({ is_active: false })
    .eq("id", customerId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Customer not found or already removed.");
  }

  return {
    id: customerId,
    orderCount: count ?? 0,
  };
}

/**
 * Loads the account view for a signed-in customer: their customer record plus
 * lifetime order stats. Returns null if no active customer row is linked yet.
 */
export async function getCustomerAccountForProfile(
  profileId: string,
): Promise<CustomerAccount | null> {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{
      id: string;
      profile_id: string | null;
      full_name: string;
      email: string | null;
      phone: string | null;
      loyalty_points: number | string | null;
    }>(
      `
        select id, profile_id, full_name, email, phone, loyalty_points
        from public.customers
        where profile_id = $1 and is_active = true
        limit 1
      `,
      [profileId],
    );

    const customer = rows[0];
    if (!customer) {
      return null;
    }

    const { rows: statRows } = await dbQuery<{
      visit_count: string | number;
      total_spent: string | number | null;
    }>(
      `
        select
          count(*) as visit_count,
          coalesce(sum(total_amount), 0) as total_spent
        from public.orders
        where customer_id = $1
          and status not in ('cancelled', 'refunded')
      `,
      [customer.id],
    );

    return {
      profileId,
      customerId: customer.id,
      fullName: customer.full_name,
      email: customer.email ?? "",
      phone: customer.phone,
      loyaltyPoints: Number(customer.loyalty_points ?? 0),
      visitCount: Number(statRows[0]?.visit_count ?? 0),
      totalSpent: Number(statRows[0]?.total_spent ?? 0),
    };
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, profile_id, full_name, email, phone, loyalty_points")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (!customer) {
    return null;
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, status")
    .eq("customer_id", customer.id);

  const activeOrders = (orders ?? []).filter(
    (order) => !["cancelled", "refunded"].includes(order.status as string),
  );

  return {
    profileId,
    customerId: customer.id as string,
    fullName: customer.full_name as string,
    email: (customer.email as string) ?? "",
    phone: (customer.phone as string) ?? null,
    loyaltyPoints: Number(customer.loyalty_points ?? 0),
    visitCount: activeOrders.length,
    totalSpent: activeOrders.reduce((sum, order) => sum + Number(order.total_amount), 0),
  };
}

/**
 * Updates the signed-in user's display name and phone on both the auth profile
 * and any linked customer record so admin views and receipts stay in sync.
 */
export async function updateCustomerProfile(input: {
  profileId: string;
  fullName: string;
  phone?: string | null;
}) {
  const phone = input.phone?.trim() || null;

  if (isPostgresConfigured()) {
    await withDbTransaction(async (client) => {
      await client.query(
        `
          update public.profiles
          set full_name = $1,
              phone = $2,
              updated_at = timezone('utc', now())
          where id = $3
        `,
        [input.fullName, phone, input.profileId],
      );

      await client.query(
        `
          update public.customers
          set full_name = $1,
              phone = $2,
              updated_at = timezone('utc', now())
          where profile_id = $3
        `,
        [input.fullName, phone, input.profileId],
      );
    });

    return;
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Profile updates");
  }

  const supabase = createSupabaseServiceRoleClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: input.fullName, phone })
    .eq("id", input.profileId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: customerError } = await supabase
    .from("customers")
    .update({ full_name: input.fullName, phone })
    .eq("profile_id", input.profileId);

  if (customerError) {
    throw new Error(customerError.message);
  }
}

function readGuestNoteValue(notes: string | null, label: string) {
  if (!notes) {
    return null;
  }
  const marker = `${label}: `;
  const start = notes.indexOf(marker);
  if (start === -1) {
    return null;
  }
  const valueStart = start + marker.length;
  const nextSeparator = notes.indexOf(" | ", valueStart);
  const value =
    nextSeparator === -1 ? notes.slice(valueStart) : notes.slice(valueStart, nextSeparator);
  return value.trim() || null;
}

export interface GuestCustomersResult {
  customers: CustomerSummary[];
  orderHistory: Record<string, CustomerOrderHistoryEntry[]>;
}

/**
 * Builds "guest customers" from ecommerce orders that were placed without a
 * linked account (customer_id is null). Orders are grouped by phone (falling
 * back to name) so repeat guests collapse into a single row.
 */
export async function listGuestCustomers(): Promise<GuestCustomersResult> {
  interface GuestOrderRow {
    id: string;
    order_number: string;
    total_amount: number | string;
    created_at: string;
    notes: string | null;
  }

  let rows: GuestOrderRow[] = [];

  if (isPostgresConfigured()) {
    const result = await dbQuery<GuestOrderRow>(
      `
        select id, order_number, total_amount, created_at, notes
        from public.orders
        where customer_id is null
          and channel = 'ecommerce'
          and status not in ('cancelled', 'refunded')
        order by created_at desc
      `,
    );
    rows = result.rows;
  } else if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceRoleClient();
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, total_amount, created_at, notes, status, customer_id, channel")
      .is("customer_id", null)
      .eq("channel", "ecommerce")
      .order("created_at", { ascending: false });

    rows = ((data ?? []) as Array<GuestOrderRow & { status: string }>)
      .filter((order) => !["cancelled", "refunded"].includes(order.status))
      .map((order) => ({
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        created_at: order.created_at,
        notes: order.notes,
      }));
  } else {
    return { customers: [], orderHistory: {} };
  }

  const groups = new Map<
    string,
    {
      key: string;
      fullName: string;
      phone: string | null;
      visitCount: number;
      totalSpent: number;
      lastSeenAt: string | null;
      history: CustomerOrderHistoryEntry[];
    }
  >();

  for (const order of rows) {
    const name = readGuestNoteValue(order.notes, "Guest");
    const phone = readGuestNoteValue(order.notes, "Phone");
    const key = (phone || name || order.id).toLowerCase();

    const existing =
      groups.get(key) ??
      {
        key,
        fullName: name || "Guest customer",
        phone: phone ?? null,
        visitCount: 0,
        totalSpent: 0,
        lastSeenAt: null as string | null,
        history: [] as CustomerOrderHistoryEntry[],
      };

    existing.visitCount += 1;
    existing.totalSpent += Number(order.total_amount);

    const createdAtTime = new Date(order.created_at).getTime();
    const lastSeenTime = existing.lastSeenAt ? new Date(existing.lastSeenAt).getTime() : 0;
    if (createdAtTime > lastSeenTime) {
      existing.lastSeenAt = order.created_at;
    }

    existing.history.push({
      id: order.id,
      orderNumber: order.order_number,
      totalAmount: Number(order.total_amount),
      createdAt: order.created_at,
    });

    groups.set(key, existing);
  }

  const customers: CustomerSummary[] = [];
  const orderHistory: Record<string, CustomerOrderHistoryEntry[]> = {};

  for (const group of groups.values()) {
    const id = `guest:${group.key}`;
    customers.push({
      id,
      profileId: null,
      fullName: group.fullName,
      email: null,
      phone: group.phone,
      loyaltyPoints: 0,
      notes: null,
      visitCount: group.visitCount,
      totalSpent: group.totalSpent,
      lastSeenAt: group.lastSeenAt,
      discountPercent: 0,
      discountExpiresAt: null,
      segment: "walk-in",
      hasAccount: false,
    });
    orderHistory[id] = group.history.slice(0, 12);
  }

  customers.sort((left, right) => (right.totalSpent ?? 0) - (left.totalSpent ?? 0));

  return { customers, orderHistory };
}
