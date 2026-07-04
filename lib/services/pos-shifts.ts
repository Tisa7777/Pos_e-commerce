import { endOfDay, startOfDay, subDays } from "date-fns";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import {
  isPostgresConfigured,
  isSupabaseConfigured,
  requireBackendConfigured,
} from "@/lib/env";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type { AppProfile, PosShiftSummary } from "@/types/domain";

type QueryExecutor = <Row extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: Row[] }>;

interface PosShiftRow {
  id: string;
  cashier_profile_id: string | null;
  opened_by_profile_id?: string | null;
  closed_by_profile_id?: string | null;
  cashier_name: string;
  status: "open" | "closed";
  opening_cash: number | string;
  closing_cash: number | string | null;
  expected_cash: number | string | null;
  cash_difference: number | string | null;
  cash_sales_amount: number | string;
  card_sales_amount: number | string;
  qr_sales_amount: number | string;
  total_sales_amount: number | string;
  order_count: number | string;
  opened_at: string;
  closed_at: string | null;
  opened_by_name?: string | null;
  closed_by_name?: string | null;
  notes: string | null;
}

interface ShiftTotals {
  cashSalesAmount: number;
  cardSalesAmount: number;
  qrSalesAmount: number;
  totalSalesAmount: number;
  orderCount: number;
}

const POS_SHIFTS_TABLE_SETUP_MESSAGE =
  "POS shift tracking needs the public.pos_shifts table. Apply supabase/migrations/004_pos_shifts.sql in your Supabase SQL editor, then refresh this page.";

class PosShiftsTableMissingError extends Error {
  constructor() {
    super(POS_SHIFTS_TABLE_SETUP_MESSAGE);
    this.name = "PosShiftsTableMissingError";
  }
}

export interface OpenPosShiftInput {
  cashierName: string;
  cashierProfileId?: string | null;
  openingCash: number;
  notes?: string | null;
}

export interface ClosePosShiftInput {
  shiftId: string;
  closingCash: number;
  notes?: string | null;
}

function isSupabasePosShiftsTableMissingError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : error instanceof Error
        ? error.message
        : "";

  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    code === "42P01" ||
    (message.includes("public.pos_shifts") && message.includes("schema cache")) ||
    message.includes('relation "public.pos_shifts" does not exist') ||
    message.includes("pos_shift_id")
  );
}

function throwPosShiftServiceError(error: { message?: string } | null) {
  if (!error) {
    return;
  }

  if (isSupabasePosShiftsTableMissingError(error)) {
    throw new PosShiftsTableMissingError();
  }

  throw new Error(error.message ?? "POS shift request failed.");
}

export async function ensurePostgresPosShiftSchema(query: QueryExecutor = dbQuery) {
  await query(`
    create table if not exists public.pos_shifts (
      id uuid primary key default gen_random_uuid(),
      cashier_profile_id uuid references public.profiles (id) on delete set null,
      opened_by_profile_id uuid references public.profiles (id) on delete set null,
      closed_by_profile_id uuid references public.profiles (id) on delete set null,
      cashier_name text not null,
      status text not null default 'open' check (status in ('open', 'closed')),
      opening_cash numeric(12, 2) not null default 0 check (opening_cash >= 0),
      closing_cash numeric(12, 2) check (closing_cash is null or closing_cash >= 0),
      expected_cash numeric(12, 2),
      cash_difference numeric(12, 2),
      cash_sales_amount numeric(12, 2) not null default 0,
      card_sales_amount numeric(12, 2) not null default 0,
      qr_sales_amount numeric(12, 2) not null default 0,
      total_sales_amount numeric(12, 2) not null default 0,
      order_count integer not null default 0,
      opened_at timestamptz not null default timezone('utc', now()),
      closed_at timestamptz,
      notes text,
      created_at timestamptz not null default timezone('utc', now()),
      updated_at timestamptz not null default timezone('utc', now())
    );

    alter table public.orders
      add column if not exists pos_shift_id uuid references public.pos_shifts (id) on delete set null;

    create index if not exists idx_pos_shifts_status_opened_at
      on public.pos_shifts (status, opened_at desc);
    create index if not exists idx_pos_shifts_cashier_profile_status
      on public.pos_shifts (cashier_profile_id, status);
    create index if not exists idx_orders_pos_shift_id
      on public.orders (pos_shift_id);
  `);
}

export function buildPosShiftCashierKey(input: {
  cashierProfileId?: string | null;
  cashierName?: string | null;
}) {
  if (input.cashierProfileId) {
    return `profile:${input.cashierProfileId}`;
  }

  return `name:${(input.cashierName ?? "cashier").trim().toLowerCase()}`;
}

export function doesShiftMatchCashier(
  shift: PosShiftSummary,
  cashier: { profileId?: string | null; name: string },
) {
  return (
    buildPosShiftCashierKey({
      cashierProfileId: shift.cashierProfileId,
      cashierName: shift.cashierName,
    }) ===
    buildPosShiftCashierKey({
      cashierProfileId: cashier.profileId,
      cashierName: cashier.name,
    })
  );
}

export async function listOpenPosShifts(): Promise<PosShiftSummary[]> {
  if (isPostgresConfigured()) {
    await ensurePostgresPosShiftSchema();
    const { rows } = await dbQuery<PosShiftRow & Record<string, unknown>>(
      buildPostgresShiftSummaryQuery("s.status = 'open'", "s.opened_at desc"),
    );

    return rows.map(mapPosShiftRow);
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pos_shifts")
    .select("*")
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (error) {
    if (isSupabasePosShiftsTableMissingError(error)) {
      return [];
    }

    throwPosShiftServiceError(error);
  }

  return hydrateSupabaseShiftSummaries((data ?? []) as PosShiftRow[], supabase);
}

export async function listPosShiftsForRange(
  start: Date = startOfDay(subDays(new Date(), 6)),
  end: Date = endOfDay(new Date()),
): Promise<PosShiftSummary[]> {
  if (isPostgresConfigured()) {
    await ensurePostgresPosShiftSchema();
    const { rows } = await dbQuery<PosShiftRow & Record<string, unknown>>(
      buildPostgresShiftSummaryQuery(
        "s.opened_at <= $2 and coalesce(s.closed_at, timezone('utc', now())) >= $1",
        "s.opened_at desc",
      ),
      [start.toISOString(), end.toISOString()],
    );

    return rows.map(mapPosShiftRow);
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pos_shifts")
    .select("*")
    .lte("opened_at", end.toISOString())
    .or(`closed_at.gte.${start.toISOString()},closed_at.is.null`)
    .order("opened_at", { ascending: false });

  if (error) {
    if (isSupabasePosShiftsTableMissingError(error)) {
      return [];
    }

    throwPosShiftServiceError(error);
  }

  return hydrateSupabaseShiftSummaries((data ?? []) as PosShiftRow[], supabase);
}

export async function openPosShift(
  profile: AppProfile,
  input: OpenPosShiftInput,
): Promise<PosShiftSummary> {
  const cashierName = input.cashierName.trim() || profile.fullName;
  const cashierProfileId = input.cashierProfileId || null;

  if (isPostgresConfigured()) {
    return withDbTransaction(async (client) => {
      await ensurePostgresPosShiftSchema((text, params = []) => client.query(text, params));
      await assertNoOpenPostgresShift(
        (text, params = []) => client.query(text, params),
        cashierProfileId,
        cashierName,
      );

      const { rows } = await client.query<{ id: string }>(
        `
          insert into public.pos_shifts (
            cashier_profile_id,
            opened_by_profile_id,
            cashier_name,
            opening_cash,
            notes
          )
          values ($1, $2, $3, $4, $5)
          returning id
        `,
        [
          cashierProfileId,
          profile.id,
          cashierName,
          input.openingCash,
          input.notes?.trim() || null,
        ],
      );

      const shift = await getPostgresShiftSummary(
        (text, params = []) => client.query(text, params),
        rows[0]!.id,
      );

      if (!shift) {
        throw new Error("Unable to open cashier shift.");
      }

      return shift;
    });
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("POS shifts");
  }

  const supabase = createSupabaseServiceRoleClient();
  await assertNoSupabaseOpenShift(supabase, cashierProfileId, cashierName);

  const { data, error } = await supabase
    .from("pos_shifts")
    .insert({
      cashier_profile_id: cashierProfileId,
      opened_by_profile_id: profile.id,
      cashier_name: cashierName,
      opening_cash: input.openingCash,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    throwPosShiftServiceError(error);
  }

  return (await hydrateSupabaseShiftSummaries([data as PosShiftRow]))[0]!;
}

export async function closePosShift(
  profile: AppProfile,
  input: ClosePosShiftInput,
): Promise<PosShiftSummary> {
  if (isPostgresConfigured()) {
    return withDbTransaction(async (client) => {
      await ensurePostgresPosShiftSchema((text, params = []) => client.query(text, params));
      const shift = await getPostgresShiftSummary(
        (text, params = []) => client.query(text, params),
        input.shiftId,
        true,
      );

      if (!shift) {
        throw new Error("Shift not found.");
      }

      if (shift.status !== "open") {
        throw new Error("This shift is already closed.");
      }

      const totals = await calculatePostgresShiftTotals(
        (text, params = []) => client.query(text, params),
        shift.id,
      );
      const expectedCash = roundMoney(shift.openingCash + totals.cashSalesAmount);
      const cashDifference = roundMoney(input.closingCash - expectedCash);

      await client.query(
        `
          update public.pos_shifts
          set
            status = 'closed',
            closed_by_profile_id = $2,
            closing_cash = $3,
            expected_cash = $4,
            cash_difference = $5,
            cash_sales_amount = $6,
            card_sales_amount = $7,
            qr_sales_amount = $8,
            total_sales_amount = $9,
            order_count = $10,
            closed_at = timezone('utc', now()),
            notes = concat_ws(E'\n', nullif(notes, ''), nullif($11, '')),
            updated_at = timezone('utc', now())
          where id = $1
        `,
        [
          shift.id,
          profile.id,
          input.closingCash,
          expectedCash,
          cashDifference,
          totals.cashSalesAmount,
          totals.cardSalesAmount,
          totals.qrSalesAmount,
          totals.totalSalesAmount,
          totals.orderCount,
          input.notes?.trim() || null,
        ],
      );

      const closedShift = await getPostgresShiftSummary(
        (text, params = []) => client.query(text, params),
        shift.id,
      );

      if (!closedShift) {
        throw new Error("Unable to close cashier shift.");
      }

      return closedShift;
    });
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("POS shifts");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: row, error: loadError } = await supabase
    .from("pos_shifts")
    .select("*")
    .eq("id", input.shiftId)
    .single();

  if (loadError) {
    throwPosShiftServiceError(loadError);
  }

  const shift = mapPosShiftRow(row as PosShiftRow);
  if (shift.status !== "open") {
    throw new Error("This shift is already closed.");
  }

  const totals = await calculateSupabaseShiftTotals(supabase, shift.id);
  const expectedCash = roundMoney(shift.openingCash + totals.cashSalesAmount);
  const cashDifference = roundMoney(input.closingCash - expectedCash);
  const existingNotes = shift.notes?.trim();
  const closeNotes = input.notes?.trim();

  const { data: updated, error: updateError } = await supabase
    .from("pos_shifts")
    .update({
      status: "closed",
      closed_by_profile_id: profile.id,
      closing_cash: input.closingCash,
      expected_cash: expectedCash,
      cash_difference: cashDifference,
      cash_sales_amount: totals.cashSalesAmount,
      card_sales_amount: totals.cardSalesAmount,
      qr_sales_amount: totals.qrSalesAmount,
      total_sales_amount: totals.totalSalesAmount,
      order_count: totals.orderCount,
      closed_at: new Date().toISOString(),
      notes: [existingNotes, closeNotes].filter(Boolean).join("\n") || null,
    })
    .eq("id", shift.id)
    .select("*")
    .single();

  if (updateError) {
    throwPosShiftServiceError(updateError);
  }

  return (await hydrateSupabaseShiftSummaries([updated as PosShiftRow]))[0]!;
}

export async function findOpenPosShiftForSale(input: {
  shiftId?: string | null;
  cashierProfileId?: string | null;
  cashierName: string;
}): Promise<PosShiftSummary | null> {
  if (isPostgresConfigured()) {
    await ensurePostgresPosShiftSchema();
    return findOpenPostgresShift(dbQuery, input);
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  return findOpenSupabaseShift(supabase, input);
}

export async function findOpenPostgresShift(
  query: QueryExecutor,
  input: {
    shiftId?: string | null;
    cashierProfileId?: string | null;
    cashierName: string;
  },
): Promise<PosShiftSummary | null> {
  if (input.shiftId) {
    const shift = await getPostgresShiftSummary(query, input.shiftId, true);
    if (!shift || shift.status !== "open") {
      return null;
    }

    return doesShiftMatchCashier(shift, {
      profileId: input.cashierProfileId,
      name: input.cashierName,
    })
      ? shift
      : null;
  }

  const { rows } = await query<PosShiftRow & Record<string, unknown>>(
    buildPostgresShiftSummaryQuery(
      `s.status = 'open'
        and (
          ($1::uuid is not null and s.cashier_profile_id = $1::uuid)
          or lower(s.cashier_name) = lower($2)
        )`,
      "s.opened_at desc",
      "limit 1",
    ),
    [input.cashierProfileId || null, input.cashierName],
  );

  return rows[0] ? mapPosShiftRow(rows[0]) : null;
}

export async function attachSupabaseOrderToShift(input: {
  orderId: string;
  shiftId: string;
}) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("orders")
    .update({ pos_shift_id: input.shiftId })
    .eq("id", input.orderId);

  if (error) {
    throwPosShiftServiceError(error);
  }
}

async function assertNoPostgresShiftByRows(
  rows: Array<{ id: string }>,
  cashierName: string,
) {
  if (rows.length > 0) {
    throw new Error(`${cashierName} already has an open shift.`);
  }
}

async function assertNoOpenPostgresShift(
  query: QueryExecutor,
  cashierProfileId: string | null,
  cashierName: string,
) {
  const { rows } = await query<{ id: string }>(
    `
      select id
      from public.pos_shifts
      where status = 'open'
        and (
          ($1::uuid is not null and cashier_profile_id = $1::uuid)
          or lower(cashier_name) = lower($2)
        )
      limit 1
    `,
    [cashierProfileId, cashierName],
  );

  await assertNoPostgresShiftByRows(rows, cashierName);
}

async function assertNoSupabaseOpenShift(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  cashierProfileId: string | null,
  cashierName: string,
) {
  const openShifts = await listOpenSupabaseShifts(supabase);
  const hasExisting = openShifts.some(
    (shift) =>
      buildPosShiftCashierKey({
        cashierProfileId: shift.cashierProfileId,
        cashierName: shift.cashierName,
      }) === buildPosShiftCashierKey({ cashierProfileId, cashierName }),
  );

  if (hasExisting) {
    throw new Error(`${cashierName} already has an open shift.`);
  }
}

async function findOpenSupabaseShift(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  input: {
    shiftId?: string | null;
    cashierProfileId?: string | null;
    cashierName: string;
  },
) {
  if (input.shiftId) {
    const { data, error } = await supabase
      .from("pos_shifts")
      .select("*")
      .eq("id", input.shiftId)
      .eq("status", "open")
      .maybeSingle();

    if (error) {
      throwPosShiftServiceError(error);
    }

    if (!data) {
      return null;
    }

    const shift = (await hydrateSupabaseShiftSummaries([data as PosShiftRow]))[0]!;
    return doesShiftMatchCashier(shift, {
      profileId: input.cashierProfileId,
      name: input.cashierName,
    })
      ? shift
      : null;
  }

  const openShifts = await listOpenSupabaseShifts(supabase);
  const key = buildPosShiftCashierKey({
    cashierProfileId: input.cashierProfileId,
    cashierName: input.cashierName,
  });

  return (
    openShifts.find(
      (shift) =>
        buildPosShiftCashierKey({
          cashierProfileId: shift.cashierProfileId,
          cashierName: shift.cashierName,
        }) === key,
    ) ?? null
  );
}

async function listOpenSupabaseShifts(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
) {
  const { data, error } = await supabase
    .from("pos_shifts")
    .select("*")
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  if (error) {
    throwPosShiftServiceError(error);
  }

  return hydrateSupabaseShiftSummaries((data ?? []) as PosShiftRow[]);
}

function buildPostgresShiftSummaryQuery(
  whereSql: string,
  orderSql: string,
  suffixSql = "",
) {
  return `
    select
      s.id,
      s.cashier_profile_id,
      s.cashier_name,
      s.status,
      s.opening_cash,
      s.closing_cash,
      s.expected_cash,
      s.cash_difference,
      coalesce(t.cash_sales_amount, s.cash_sales_amount, 0) as cash_sales_amount,
      coalesce(t.card_sales_amount, s.card_sales_amount, 0) as card_sales_amount,
      coalesce(t.qr_sales_amount, s.qr_sales_amount, 0) as qr_sales_amount,
      coalesce(t.total_sales_amount, s.total_sales_amount, 0) as total_sales_amount,
      coalesce(t.order_count, s.order_count, 0) as order_count,
      s.opened_at,
      s.closed_at,
      opener.full_name as opened_by_name,
      closer.full_name as closed_by_name,
      s.notes
    from public.pos_shifts s
    left join public.profiles opener on opener.id = s.opened_by_profile_id
    left join public.profiles closer on closer.id = s.closed_by_profile_id
    left join lateral (
      select
        count(o.id)::integer as order_count,
        coalesce(sum(o.total_amount), 0) as total_sales_amount,
        coalesce(sum(case when coalesce(p.method::text, 'cash') = 'cash' then o.total_amount else 0 end), 0) as cash_sales_amount,
        coalesce(sum(case when p.method::text = 'card' then o.total_amount else 0 end), 0) as card_sales_amount,
        coalesce(sum(case when p.method::text = 'qr' then o.total_amount else 0 end), 0) as qr_sales_amount
      from public.orders o
      left join lateral (
        select method
        from public.payments
        where order_id = o.id
        order by created_at desc
        limit 1
      ) p on true
      where o.pos_shift_id = s.id
        and o.channel = 'pos'
        and o.status <> 'cancelled'
        and o.payment_status in ('paid', 'partially_refunded')
    ) t on true
    where ${whereSql}
    order by ${orderSql}
    ${suffixSql}
  `;
}

async function getPostgresShiftSummary(
  query: QueryExecutor,
  shiftId: string,
  forUpdate = false,
) {
  if (forUpdate) {
    await query("select id from public.pos_shifts where id = $1 for update", [shiftId]);
  }

  const { rows } = await query<PosShiftRow & Record<string, unknown>>(
    buildPostgresShiftSummaryQuery(
      "s.id = $1",
      "s.opened_at desc",
      "limit 1",
    ),
    [shiftId],
  );

  return rows[0] ? mapPosShiftRow(rows[0]) : null;
}

async function calculatePostgresShiftTotals(
  query: QueryExecutor,
  shiftId: string,
): Promise<ShiftTotals> {
  const { rows } = await query<{
    cash_sales_amount: number | string;
    card_sales_amount: number | string;
    qr_sales_amount: number | string;
    total_sales_amount: number | string;
    order_count: number | string;
  }>(
    `
      select
        count(o.id)::integer as order_count,
        coalesce(sum(o.total_amount), 0) as total_sales_amount,
        coalesce(sum(case when coalesce(p.method::text, 'cash') = 'cash' then o.total_amount else 0 end), 0) as cash_sales_amount,
        coalesce(sum(case when p.method::text = 'card' then o.total_amount else 0 end), 0) as card_sales_amount,
        coalesce(sum(case when p.method::text = 'qr' then o.total_amount else 0 end), 0) as qr_sales_amount
      from public.orders o
      left join lateral (
        select method
        from public.payments
        where order_id = o.id
        order by created_at desc
        limit 1
      ) p on true
      where o.pos_shift_id = $1
        and o.channel = 'pos'
        and o.status <> 'cancelled'
        and o.payment_status in ('paid', 'partially_refunded')
    `,
    [shiftId],
  );

  const row = rows[0];
  return {
    cashSalesAmount: Number(row?.cash_sales_amount ?? 0),
    cardSalesAmount: Number(row?.card_sales_amount ?? 0),
    qrSalesAmount: Number(row?.qr_sales_amount ?? 0),
    totalSalesAmount: Number(row?.total_sales_amount ?? 0),
    orderCount: Number(row?.order_count ?? 0),
  };
}

async function calculateSupabaseShiftTotals(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  shiftId: string,
): Promise<ShiftTotals> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, total_amount, channel, status, payment_status, payments(method, created_at)")
    .eq("pos_shift_id", shiftId)
    .eq("channel", "pos")
    .neq("status", "cancelled")
    .in("payment_status", ["paid", "partially_refunded"]);

  if (error) {
    throwPosShiftServiceError(error);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    total_amount: number | string;
    payments?: Array<{ method?: string | null; created_at?: string | null }> | null;
  }>;

  return rows.reduce<ShiftTotals>(
    (totals, order) => {
      const method = order.payments?.[0]?.method ?? "cash";
      const amount = Number(order.total_amount);

      totals.totalSalesAmount += amount;
      totals.orderCount += 1;

      if (method === "card") {
        totals.cardSalesAmount += amount;
      } else if (method === "qr") {
        totals.qrSalesAmount += amount;
      } else {
        totals.cashSalesAmount += amount;
      }

      return totals;
    },
    {
      cashSalesAmount: 0,
      cardSalesAmount: 0,
      qrSalesAmount: 0,
      totalSalesAmount: 0,
      orderCount: 0,
    },
  );
}

async function hydrateSupabaseShiftSummaries(
  rows: PosShiftRow[],
  supabase = createSupabaseServiceRoleClient(),
): Promise<PosShiftSummary[]> {
  if (rows.length === 0) {
    return [];
  }

  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.opened_by_profile_id, row.closed_by_profile_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profileNameById = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profileIds);

    for (const profile of (data ?? []) as Array<{
      id: string;
      full_name?: string | null;
      email?: string | null;
    }>) {
      profileNameById.set(profile.id, profile.full_name ?? profile.email ?? "Staff");
    }
  }

  const summaries = await Promise.all(
    rows.map(async (row) => {
      const mapped = mapPosShiftRow(row);
      const totals = await calculateSupabaseShiftTotals(supabase, mapped.id);

      return {
        ...mapped,
        cashSalesAmount: totals.cashSalesAmount || mapped.cashSalesAmount,
        cardSalesAmount: totals.cardSalesAmount || mapped.cardSalesAmount,
        qrSalesAmount: totals.qrSalesAmount || mapped.qrSalesAmount,
        totalSalesAmount: totals.totalSalesAmount || mapped.totalSalesAmount,
        orderCount: totals.orderCount || mapped.orderCount,
        expectedCash:
          mapped.status === "open"
            ? roundMoney(mapped.openingCash + totals.cashSalesAmount)
            : mapped.expectedCash,
        openedByName:
          mapped.openedByName ??
          profileNameById.get(row.opened_by_profile_id ?? "") ??
          null,
        closedByName:
          mapped.closedByName ??
          profileNameById.get(row.closed_by_profile_id ?? "") ??
          null,
      };
    }),
  );

  return summaries;
}

function mapPosShiftRow(row: PosShiftRow): PosShiftSummary {
  return {
    id: row.id,
    cashierProfileId: row.cashier_profile_id,
    cashierName: row.cashier_name,
    status: row.status,
    openingCash: Number(row.opening_cash),
    closingCash: row.closing_cash === null ? null : Number(row.closing_cash),
    expectedCash: row.expected_cash === null ? null : Number(row.expected_cash),
    cashDifference: row.cash_difference === null ? null : Number(row.cash_difference),
    cashSalesAmount: Number(row.cash_sales_amount ?? 0),
    cardSalesAmount: Number(row.card_sales_amount ?? 0),
    qrSalesAmount: Number(row.qr_sales_amount ?? 0),
    totalSalesAmount: Number(row.total_sales_amount ?? 0),
    orderCount: Number(row.order_count ?? 0),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openedByName: row.opened_by_name ?? null,
    closedByName: row.closed_by_name ?? null,
    notes: row.notes,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
