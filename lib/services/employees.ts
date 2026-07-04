import {
  isPostgresConfigured,
  isSupabaseConfigured,
  requireBackendConfigured,
} from "@/lib/env";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import { hashPassword } from "@/lib/auth/password";
import { parsePosReceiptMetadata } from "@/lib/pos/receipt-metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PoolClient } from "pg";
import type {
  EmployeePayType,
  EmployeeRole,
  EmployeeStatus,
  EmployeeSummary,
  PosCashierOption,
  UserRole,
} from "@/types/domain";

export const EMPLOYEES_TABLE_SETUP_MESSAGE =
  "Employee management needs the public.employees table. Apply supabase/migrations/003_employees.sql in your Supabase SQL editor, then refresh this page.";

export class EmployeesTableMissingError extends Error {
  constructor() {
    super(EMPLOYEES_TABLE_SETUP_MESSAGE);
    this.name = "EmployeesTableMissingError";
  }
}

export interface EmployeeInput {
  fullName: string;
  email?: string;
  phone?: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  payType: EmployeePayType;
  salaryAmount: number;
  hourlyRate: number;
  workDays: string[];
  shiftStart?: string;
  shiftEnd?: string;
  startDate?: string;
  emergencyContact?: string;
  address?: string;
  notes?: string;
  password?: string;
}

interface EmployeeRow {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: EmployeeRole;
  status: EmployeeStatus;
  pay_type: EmployeePayType;
  salary_amount: number | string;
  hourly_rate: number | string;
  work_days: string[] | null;
  shift_start: string | null;
  shift_end: string | null;
  start_date: string | null;
  emergency_contact: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeSalesOrderRow {
  cashier_profile_id: string | null;
  notes: string | null;
  total_amount: number | string | null;
  created_at: string;
}

interface EmployeeSalesStats {
  salesCount: number;
  salesRevenue: number;
  lastSaleAt: string | null;
}

let ensuredPostgresEmployeesTable = false;

export function isEmployeesTableMissingError(error: unknown) {
  return error instanceof EmployeesTableMissingError;
}

function isSupabaseEmployeesTableMissingError(error: unknown) {
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
    (message.includes("public.employees") && message.includes("schema cache")) ||
    message.includes('relation "public.employees" does not exist')
  );
}

function throwEmployeeServiceError(error: { message?: string } | null) {
  if (!error) {
    return;
  }

  if (isSupabaseEmployeesTableMissingError(error)) {
    throw new EmployeesTableMissingError();
  }

  throw new Error(error.message ?? "Employee request failed.");
}

function mapEmployee(row: EmployeeRow): EmployeeSummary {
  return {
    id: row.id,
    profileId: row.profile_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    payType: row.pay_type,
    salaryAmount: Number(row.salary_amount),
    hourlyRate: Number(row.hourly_rate),
    workDays: row.work_days ?? [],
    shiftStart: normalizeTime(row.shift_start),
    shiftEnd: normalizeTime(row.shift_end),
    startDate: normalizeDate(row.start_date),
    emergencyContact: row.emergency_contact,
    address: row.address,
    notes: row.notes,
    salesCount: 0,
    salesRevenue: 0,
    lastSaleAt: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeEmployeeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function emptyEmployeeSalesStats(): EmployeeSalesStats {
  return {
    salesCount: 0,
    salesRevenue: 0,
    lastSaleAt: null,
  };
}

function applyEmployeeSalesStats(
  employees: EmployeeSummary[],
  statsByEmployeeId: Map<string, EmployeeSalesStats>,
) {
  return employees.map((employee) => {
    const stats = statsByEmployeeId.get(employee.id) ?? emptyEmployeeSalesStats();

    return {
      ...employee,
      salesCount: stats.salesCount,
      salesRevenue: stats.salesRevenue,
      lastSaleAt: stats.lastSaleAt,
    };
  });
}

function buildEmployeeSalesStats(
  employees: EmployeeSummary[],
  orders: EmployeeSalesOrderRow[],
) {
  const employeeIdByProfileId = new Map<string, string>();
  const employeeIdByName = new Map<string, string>();
  const statsByEmployeeId = new Map<string, EmployeeSalesStats>();

  for (const employee of employees) {
    if (employee.profileId) {
      employeeIdByProfileId.set(employee.profileId, employee.id);
    }

    employeeIdByName.set(normalizeEmployeeName(employee.fullName), employee.id);
  }

  for (const order of orders) {
    const metadata = parsePosReceiptMetadata(order.notes);
    const cashierName = metadata.cashierName?.trim() || "";
    const employeeId =
      (cashierName ? employeeIdByName.get(normalizeEmployeeName(cashierName)) : undefined) ??
      (order.cashier_profile_id ? employeeIdByProfileId.get(order.cashier_profile_id) : undefined);

    if (!employeeId) {
      continue;
    }

    const stats = statsByEmployeeId.get(employeeId) ?? emptyEmployeeSalesStats();
    stats.salesCount += 1;
    stats.salesRevenue += Number(order.total_amount ?? metadata.displayTotal ?? 0);
    stats.lastSaleAt =
      !stats.lastSaleAt || order.created_at > stats.lastSaleAt ? order.created_at : stats.lastSaleAt;
    statsByEmployeeId.set(employeeId, stats);
  }

  return statsByEmployeeId;
}

async function loadEmployeeSalesStats(employees: EmployeeSummary[]) {
  if (employees.length === 0) {
    return new Map<string, EmployeeSalesStats>();
  }

  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<EmployeeSalesOrderRow>(
      `
        select cashier_profile_id, notes, total_amount, created_at
        from public.orders
        where channel = 'pos'
          and payment_status in ('paid', 'partially_refunded')
          and status <> 'cancelled'
      `,
    );

    return buildEmployeeSalesStats(employees, rows);
  }

  if (!isSupabaseConfigured()) {
    return new Map<string, EmployeeSalesStats>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("cashier_profile_id, notes, total_amount, created_at")
    .eq("channel", "pos")
    .in("payment_status", ["paid", "partially_refunded"])
    .neq("status", "cancelled");

  if (error) {
    throw new Error(error.message);
  }

  return buildEmployeeSalesStats(employees, (data ?? []) as EmployeeSalesOrderRow[]);
}

async function withEmployeeSalesStats(employees: EmployeeSummary[]) {
  const statsByEmployeeId = await loadEmployeeSalesStats(employees);
  return applyEmployeeSalesStats(employees, statsByEmployeeId);
}

function normalizeTime(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function normalizeDate(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function cleanInput(input: EmployeeInput) {
  return {
    ...input,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    shiftStart: input.shiftStart?.trim() || null,
    shiftEnd: input.shiftEnd?.trim() || null,
    startDate: input.startDate?.trim() || null,
    emergencyContact: input.emergencyContact?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    workDays: input.workDays ?? [],
    password: input.password?.trim() || null,
  };
}

async function ensurePostgresEmployeesTable() {
  if (ensuredPostgresEmployeesTable) {
    return;
  }

  await dbQuery(`
    create table if not exists public.employees (
      id uuid primary key default gen_random_uuid(),
      profile_id uuid references public.profiles (id) on delete set null,
      full_name text not null,
      email citext,
      phone text,
      role text not null default 'cashier'
        check (role in ('admin', 'manager', 'cashier', 'inventory', 'support')),
      status text not null default 'active'
        check (status in ('active', 'on_leave', 'inactive')),
      pay_type text not null default 'salary'
        check (pay_type in ('salary', 'hourly', 'commission')),
      salary_amount numeric(12, 2) not null default 0 check (salary_amount >= 0),
      hourly_rate numeric(10, 2) not null default 0 check (hourly_rate >= 0),
      work_days text[] not null default '{}',
      shift_start time,
      shift_end time,
      start_date date,
      emergency_contact text,
      address text,
      notes text,
      created_at timestamptz not null default timezone('utc', now()),
      updated_at timestamptz not null default timezone('utc', now())
    );

    create index if not exists idx_employees_profile_id on public.employees (profile_id);
    create index if not exists idx_employees_role_status on public.employees (role, status);
    create index if not exists idx_employees_email on public.employees (email);

    do $$
    begin
      if not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'idx_employees_profile_id_unique'
      )
      and not exists (
        select 1
        from public.employees
        where profile_id is not null
        group by profile_id
        having count(*) > 1
      ) then
        create unique index idx_employees_profile_id_unique
          on public.employees (profile_id)
          where profile_id is not null;
      end if;
    end $$;

    do $$
    begin
      if not exists (
        select 1
        from pg_trigger
        where tgname = 'set_employees_updated_at'
      ) then
        create trigger set_employees_updated_at
        before update on public.employees
        for each row execute function public.set_updated_at();
      end if;
    end $$;
  `);

  await backfillPostgresStaffEmployees();

  ensuredPostgresEmployeesTable = true;
}

async function backfillPostgresStaffEmployees() {
  await withDbTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext('tisa_staff_employee_backfill'))");
    await client.query(`
      update public.employees e
      set profile_id = p.id
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where e.profile_id is null
        and e.email is not null
        and lower(e.email::text) = lower(p.email::text)
        and ur.role in ('admin', 'manager', 'clerk', 'cashier');

      insert into public.employees (
        profile_id,
        full_name,
        email,
        phone,
        role,
        status,
        pay_type,
        salary_amount,
        hourly_rate,
        work_days,
        start_date,
        notes
      )
      select
        p.id,
        p.full_name,
        p.email,
        p.phone,
        case
          when bool_or(ur.role = 'admin') then 'admin'
          when bool_or(ur.role = 'manager') then 'manager'
          when bool_or(ur.role = 'clerk') then 'inventory'
          else 'cashier'
        end,
        'active',
        'salary',
        0,
        0,
        array[]::text[],
        current_date,
        'Created automatically from staff account roles.'
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      where ur.role in ('admin', 'manager', 'clerk', 'cashier')
        and not exists (
          select 1
          from public.employees e
          where e.profile_id = p.id
            or lower(coalesce(e.email::text, '')) = lower(p.email::text)
        )
      group by p.id, p.full_name, p.email, p.phone
      on conflict do nothing;
    `);
  });
}

async function findPostgresProfileIdByEmail(email: string | null, client?: PoolClient) {
  if (!email) {
    return null;
  }

  const { rows } = client
    ? await client.query<{ id: string }>(
        `
          select id
          from public.profiles
          where lower(email::text) = lower($1)
          limit 1
        `,
        [email],
      )
    : await dbQuery<{ id: string }>(
        `
          select id
          from public.profiles
          where lower(email::text) = lower($1)
          limit 1
        `,
        [email],
      );

  return rows[0]?.id ?? null;
}

/**
 * Maps an employee job position to the auth role that grants a sign-in account.
 *   admin     -> admin   (full admin / Owner)
 *   cashier   -> cashier (POS)
 *   inventory -> clerk   (limited admin: products + inventory)
 *   manager   -> manager (limited admin: reports + analytics + read-only orders)
 */
function employeeRoleToAuthRole(role: EmployeeRole): UserRole | null {
  switch (role) {
    case "admin":
      return "admin";
    case "cashier":
      return "cashier";
    case "inventory":
      return "clerk";
    case "manager":
      return "manager";
    default:
      return null;
  }
}

async function assertCanRemovePostgresAuthRole(
  profileId: string,
  authRole: UserRole,
  client: PoolClient,
) {
  if (authRole !== "admin") {
    return;
  }

  const { rows } = await client.query<{ count: string }>(
    `
      select count(*)::text as count
      from public.user_roles
      where role = 'admin'
        and profile_id <> $1
    `,
    [profileId],
  );

  if (Number(rows[0]?.count ?? "0") === 0) {
    throw new Error("Cannot remove the last administrator.");
  }
}

async function syncPostgresEmployeeAuthRole(
  client: PoolClient,
  input: {
    profileId: string | null;
    role: EmployeeRole;
    previousProfileId?: string | null;
    previousRole?: EmployeeRole | null;
  },
) {
  const authRole = employeeRoleToAuthRole(input.role);
  const previousAuthRole = input.previousRole
    ? employeeRoleToAuthRole(input.previousRole)
    : null;

  if (
    input.previousProfileId &&
    previousAuthRole &&
    (
      input.previousProfileId !== input.profileId ||
      previousAuthRole !== authRole
    )
  ) {
    await assertCanRemovePostgresAuthRole(
      input.previousProfileId,
      previousAuthRole,
      client,
    );
    await client.query(
      `
        delete from public.user_roles
        where profile_id = $1
          and role = $2::public.user_role
      `,
      [input.previousProfileId, previousAuthRole],
    );
  }

  if (!input.profileId || !authRole) {
    return;
  }

  await client.query(
    `
      insert into public.user_roles (profile_id, role)
      values ($1, $2::public.user_role)
      on conflict (profile_id, role) do nothing
    `,
    [input.profileId, authRole],
  );
}

/**
 * Ensures a staff employee (admin/cashier/inventory) has a real sign-in account.
 * - Links to an existing profile when the email already has one.
 * - Creates a new profile (with a hashed password) when none exists.
 * - Updates the password when a new one is provided.
 * Returns the linked profile id, or null when no login is needed/possible.
 */
async function ensurePostgresStaffLoginAccount(input: {
  email: string | null;
  fullName: string;
  phone: string | null;
  role: EmployeeRole;
  password: string | null;
}, client?: PoolClient): Promise<string | null> {
  if (!employeeRoleToAuthRole(input.role)) {
    // Non-login roles still link to a profile if one happens to exist.
    return findPostgresProfileIdByEmail(input.email, client);
  }

  if (!input.email) {
    return null;
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const existingId = await findPostgresProfileIdByEmail(normalizedEmail, client);
  const passwordHash = input.password ? await hashPassword(input.password) : null;

  if (existingId) {
    if (passwordHash) {
      if (client) {
        await client.query(
          `update public.profiles set password_hash = $2 where id = $1`,
          [existingId, passwordHash],
        );
      } else {
        await dbQuery(
          `update public.profiles set password_hash = $2 where id = $1`,
          [existingId, passwordHash],
        );
      }
    }

    return existingId;
  }

  if (!passwordHash) {
    throw new Error("Set a password to create a login for this staff email.");
  }

  try {
    const { rows } = client
      ? await client.query<{ id: string }>(
          `
            insert into public.profiles (email, full_name, phone, password_hash)
            values ($1, $2, $3, $4)
            returning id
          `,
          [normalizedEmail, input.fullName, input.phone, passwordHash],
        )
      : await dbQuery<{ id: string }>(
          `
            insert into public.profiles (email, full_name, phone, password_hash)
            values ($1, $2, $3, $4)
            returning id
          `,
          [normalizedEmail, input.fullName, input.phone, passwordHash],
        );

    return rows[0]?.id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("profiles_email_key")) {
      throw new Error("An account with that email already exists.");
    }

    throw error;
  }
}

async function assertPostgresEmployeeAccountAvailable(input: {
  profileId: string | null;
  email: string | null;
  employeeId?: string;
  client: PoolClient;
}) {
  if (!input.profileId && !input.email) {
    return;
  }

  const { rows } = await input.client.query<{ id: string }>(
    `
      select id
      from public.employees
      where ($1::uuid is not null and profile_id = $1::uuid)
         or ($2::text is not null and lower(coalesce(email::text, '')) = lower($2::text))
      limit 1
    `,
    [input.profileId, input.email],
  );
  const matchingEmployeeId = rows[0]?.id;

  if (matchingEmployeeId && matchingEmployeeId !== input.employeeId) {
    throw new Error("An employee record already exists for this staff account.");
  }
}

async function findSupabaseProfileIdByEmail(email: string | null) {
  if (!email) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function syncSupabaseStaffRole(profileId: string | null, role: EmployeeRole) {
  const authRole = employeeRoleToAuthRole(role);
  if (!profileId || !authRole) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_roles")
    .upsert(
      {
        profile_id: profileId,
        role: authRole,
      },
      {
        onConflict: "profile_id,role",
      },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listEmployees(): Promise<EmployeeSummary[]> {
  if (isPostgresConfigured()) {
    await ensurePostgresEmployeesTable();
    const { rows } = await dbQuery<EmployeeRow>(
      `
        select *
        from public.employees
        order by
          case status
            when 'active' then 1
            when 'on_leave' then 2
            else 3
          end,
          full_name asc
      `,
    );

    return withEmployeeSalesStats(rows.map(mapEmployee));
  }

  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("status", { ascending: true })
    .order("full_name", { ascending: true });

  throwEmployeeServiceError(error);

  return withEmployeeSalesStats(((data ?? []) as EmployeeRow[]).map(mapEmployee));
}

export async function listPosCashierOptions(): Promise<PosCashierOption[]> {
  try {
    const employees = await listEmployees();

    return employees
      .filter(
        (employee) =>
          employee.status === "active" &&
          employee.role === "cashier",
      )
      .map((employee) => ({
        id: employee.id,
        name: employee.fullName,
        profileId: employee.profileId,
        role: employee.role,
      }));
  } catch (error) {
    if (isEmployeesTableMissingError(error)) {
      return [];
    }

    throw error;
  }
}

export async function createEmployee(input: EmployeeInput) {
  const employee = cleanInput(input);

  if (isPostgresConfigured()) {
    await ensurePostgresEmployeesTable();
    const employeeId = await withDbTransaction(async (client) => {
      const profileId = await ensurePostgresStaffLoginAccount({
        email: employee.email,
        fullName: employee.fullName,
        phone: employee.phone,
        role: employee.role,
        password: employee.password,
      }, client);

      await assertPostgresEmployeeAccountAvailable({
        profileId,
        email: employee.email,
        client,
      });

      const { rows } = await client.query<{ id: string }>(
        `
          insert into public.employees (
            profile_id,
            full_name,
            email,
            phone,
            role,
            status,
            pay_type,
            salary_amount,
            hourly_rate,
            work_days,
            shift_start,
            shift_end,
            start_date,
            emergency_contact,
            address,
            notes
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, $12, $13, $14, $15, $16)
          returning id
        `,
        [
          profileId,
          employee.fullName,
          employee.email,
          employee.phone,
          employee.role,
          employee.status,
          employee.payType,
          employee.salaryAmount,
          employee.hourlyRate,
          employee.workDays,
          employee.shiftStart,
          employee.shiftEnd,
          employee.startDate,
          employee.emergencyContact,
          employee.address,
          employee.notes,
        ],
      );

      await syncPostgresEmployeeAuthRole(client, {
        profileId,
        role: employee.role,
      });

      return rows[0]!.id;
    });

    return getEmployeeById(employeeId);
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Employee management");
  }

  const profileId = await findSupabaseProfileIdByEmail(employee.email);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({
      profile_id: profileId,
      full_name: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      status: employee.status,
      pay_type: employee.payType,
      salary_amount: employee.salaryAmount,
      hourly_rate: employee.hourlyRate,
      work_days: employee.workDays,
      shift_start: employee.shiftStart,
      shift_end: employee.shiftEnd,
      start_date: employee.startDate,
      emergency_contact: employee.emergencyContact,
      address: employee.address,
      notes: employee.notes,
    })
    .select("id")
    .single();

  throwEmployeeServiceError(error);

  if (!data) {
    throw new Error("Unable to create employee.");
  }

  await syncSupabaseStaffRole(profileId, employee.role);

  return getEmployeeById(data.id);
}

export async function updateEmployee(input: EmployeeInput & { id: string }) {
  const employee = cleanInput(input);

  if (isPostgresConfigured()) {
    await ensurePostgresEmployeesTable();
    await withDbTransaction(async (client) => {
      const existing = await client.query<EmployeeRow>(
        "select * from public.employees where id = $1 for update",
        [input.id],
      );

      if (!existing.rows[0]) {
        throw new Error("Employee not found.");
      }

      const profileId = await ensurePostgresStaffLoginAccount({
        email: employee.email,
        fullName: employee.fullName,
        phone: employee.phone,
        role: employee.role,
        password: employee.password,
      }, client);

      await assertPostgresEmployeeAccountAvailable({
        profileId,
        email: employee.email,
        employeeId: input.id,
        client,
      });

      await client.query(
        `
          update public.employees
          set profile_id = $1,
              full_name = $2,
              email = $3,
              phone = $4,
              role = $5,
              status = $6,
              pay_type = $7,
              salary_amount = $8,
              hourly_rate = $9,
              work_days = $10::text[],
              shift_start = $11,
              shift_end = $12,
              start_date = $13,
              emergency_contact = $14,
              address = $15,
              notes = $16
          where id = $17
        `,
        [
          profileId,
          employee.fullName,
          employee.email,
          employee.phone,
          employee.role,
          employee.status,
          employee.payType,
          employee.salaryAmount,
          employee.hourlyRate,
          employee.workDays,
          employee.shiftStart,
          employee.shiftEnd,
          employee.startDate,
          employee.emergencyContact,
          employee.address,
          employee.notes,
          input.id,
        ],
      );

      await syncPostgresEmployeeAuthRole(client, {
        profileId,
        role: employee.role,
        previousProfileId: existing.rows[0].profile_id,
        previousRole: existing.rows[0].role,
      });
    });

    return getEmployeeById(input.id);
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Employee management");
  }

  const profileId = await findSupabaseProfileIdByEmail(employee.email);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({
      profile_id: profileId,
      full_name: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      status: employee.status,
      pay_type: employee.payType,
      salary_amount: employee.salaryAmount,
      hourly_rate: employee.hourlyRate,
      work_days: employee.workDays,
      shift_start: employee.shiftStart,
      shift_end: employee.shiftEnd,
      start_date: employee.startDate,
      emergency_contact: employee.emergencyContact,
      address: employee.address,
      notes: employee.notes,
    })
    .eq("id", input.id);

  throwEmployeeServiceError(error);

  await syncSupabaseStaffRole(profileId, employee.role);

  return getEmployeeById(input.id);
}

export async function deleteEmployee(id: string) {
  if (isPostgresConfigured()) {
    await ensurePostgresEmployeesTable();
    await dbQuery("delete from public.employees where id = $1", [id]);
    return { id };
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Employee management");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);

  throwEmployeeServiceError(error);

  return { id };
}

async function getEmployeeById(id: string) {
  if (isPostgresConfigured()) {
    await ensurePostgresEmployeesTable();
    const { rows } = await dbQuery<EmployeeRow>(
      "select * from public.employees where id = $1 limit 1",
      [id],
    );

    if (!rows[0]) {
      return null;
    }

    const [employee] = await withEmployeeSalesStats([mapEmployee(rows[0])]);
    return employee ?? null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  throwEmployeeServiceError(error);

  if (!data) {
    return null;
  }

  const [employee] = await withEmployeeSalesStats([mapEmployee(data as EmployeeRow)]);
  return employee ?? null;
}
