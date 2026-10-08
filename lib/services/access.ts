import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import { isPostgresConfigured } from "@/lib/env";
import {
  ALL_PERMISSION_KEYS,
  BUILT_IN_ROLE_DEFINITIONS,
  OWNER_ONLY_PERMISSIONS,
  getRolePermissionMap,
} from "@/lib/auth/permissions";
import type { RoleDefinition, UserRole } from "@/types/domain";

export interface StaffAccount {
  id: string;
  fullName: string;
  email: string;
  roles: UserRole[];
}

export interface CreateRoleInput {
  label: string;
  description?: string;
}

const BUILT_IN_ROLE_VALUES = new Set(BUILT_IN_ROLE_DEFINITIONS.map((role) => role.role));
const SYSTEM_ROLE_ORDER = new Map<string, number>([
  ["admin", 0],
  ["manager", 10],
  ["clerk", 20],
  ["cashier", 30],
  ["customer", 1000],
]);
const ROLE_SLUG_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

let ensuredRoleDefinitionSchema = false;
let ensureRoleDefinitionSchemaPromise: Promise<void> | null = null;

export async function listRoleDefinitions(): Promise<RoleDefinition[]> {
  if (!isPostgresConfigured()) {
    return [...BUILT_IN_ROLE_DEFINITIONS];
  }

  try {
    await ensureRoleDefinitionSchema();
    const { rows } = await dbQuery<{
      role: string;
      label: string;
      description: string;
      kind: RoleDefinition["kind"];
      is_system: boolean;
    }>(
      `
        select role::text as role, label, description, kind, is_system
        from public.app_roles
        where is_active = true
      `,
    );

    const byRole = new Map<string, RoleDefinition>();
    for (const definition of BUILT_IN_ROLE_DEFINITIONS) {
      byRole.set(definition.role, definition);
    }
    for (const row of rows) {
      byRole.set(row.role, {
        role: row.role,
        label: row.label,
        description: row.description,
        kind: row.kind,
        isSystem: row.is_system,
      });
    }

    return sortRoleDefinitions(Array.from(byRole.values()));
  } catch {
    return [...BUILT_IN_ROLE_DEFINITIONS];
  }
}

/** Returns the current permission grants for the configurable roles. */
export async function getConfigurableRolePermissions(): Promise<Record<string, string[]>> {
  const roleDefinitions = await listRoleDefinitions();
  const map = await getRolePermissionMap();
  const result: Record<string, string[]> = {};
  for (const roleDefinition of roleDefinitions) {
    if (roleDefinition.kind !== "editable") {
      continue;
    }
    result[roleDefinition.role] = Array.from(map.get(roleDefinition.role) ?? []).filter((key) =>
      ALL_PERMISSION_KEYS.includes(key),
    );
  }
  return result;
}

export async function createRole(input: CreateRoleInput): Promise<RoleDefinition> {
  if (!isPostgresConfigured()) {
    throw new Error("Creating roles requires the PostgreSQL backend.");
  }

  const label = normalizeRoleLabel(input.label);
  if (label.length < 2) {
    throw new Error("Role name must be at least 2 characters.");
  }
  if (label.length > 60) {
    throw new Error("Role name must be 60 characters or fewer.");
  }

  const role = slugifyRole(label);
  if (!ROLE_SLUG_PATTERN.test(role)) {
    throw new Error("Role name must include letters or numbers.");
  }
  if (BUILT_IN_ROLE_VALUES.has(role)) {
    throw new Error("That built-in role already exists.");
  }

  await ensureRoleDefinitionSchema();

  const existing = await dbQuery<{ is_active: boolean }>(
    `select is_active from public.app_roles where role::text = $1 limit 1`,
    [role],
  );
  if (existing.rows[0]?.is_active) {
    throw new Error("A role with that name already exists.");
  }

  await dbQuery(`alter type public.user_role add value if not exists ${quoteSqlLiteral(role)}`);

  const description =
    normalizeRoleDescription(input.description) || "Custom back-office role.";

  await dbQuery(
    `
      insert into public.app_roles (role, label, description, kind, is_system, is_active)
      values ($1::public.user_role, $2, $3, 'editable', false, true)
      on conflict (role) do update
        set label = excluded.label,
            description = excluded.description,
            kind = 'editable',
            is_system = false,
            is_active = true,
            updated_at = timezone('utc', now())
    `,
    [role, label, description],
  );

  return {
    role,
    label,
    description,
    kind: "editable",
    isSystem: false,
  };
}

/** Removes a custom role from RBAC and clears its grants/assignments. */
export async function removeRole(role: UserRole) {
  if (!isPostgresConfigured()) {
    throw new Error("Removing roles requires the PostgreSQL backend.");
  }

  await ensureRoleDefinitionSchema();

  const { rows } = await dbQuery<{
    role: string;
    label: string;
    is_system: boolean;
    is_active: boolean;
  }>(
    `
      select role::text as role, label, is_system, is_active
      from public.app_roles
      where role::text = $1
      limit 1
    `,
    [role],
  );

  const definition = rows[0];
  if (!definition?.is_active) {
    throw new Error("That role does not exist.");
  }
  if (definition.is_system || BUILT_IN_ROLE_VALUES.has(role)) {
    throw new Error("Built-in roles cannot be removed.");
  }

  await withDbTransaction(async (client) => {
    await client.query(`delete from public.role_permissions where role = $1::public.user_role`, [
      role,
    ]);

    // Demote anyone whose ONLY role was this one, otherwise they would be left
    // with zero roles: they'd land on /shop and disappear from Roles & Access
    // (which lists staff via `bool_or(role <> 'customer')`), leaving no way to
    // reassign them from the UI.
    await client.query(
      `
        insert into public.user_roles (profile_id, role)
        select ur.profile_id, 'customer'::public.user_role
        from public.user_roles ur
        where ur.role = $1::public.user_role
          and not exists (
            select 1
            from public.user_roles other
            where other.profile_id = ur.profile_id
              and other.role <> $1::public.user_role
          )
        on conflict (profile_id, role) do nothing
      `,
      [role],
    );

    await client.query(`delete from public.user_roles where role = $1::public.user_role`, [role]);
    await client.query(
      `
        update public.app_roles
        set is_active = false,
            updated_at = timezone('utc', now())
        where role = $1::public.user_role
      `,
      [role],
    );
  });
}

/** Replaces the permission set for a single configurable role. */
export async function setRolePermissions(role: UserRole, permissions: string[]) {
  if (!isPostgresConfigured()) {
    throw new Error("Editing permissions requires the PostgreSQL backend.");
  }
  await ensureRoleDefinitionSchema();
  const roleDefinition = (await listRoleDefinitions()).find(
    (definition) => definition.role === role,
  );
  if (!roleDefinition || roleDefinition.kind !== "editable") {
    throw new Error("That role's permissions cannot be edited.");
  }

  const cleaned = Array.from(new Set(permissions)).filter((key) =>
    ALL_PERMISSION_KEYS.includes(key),
  );

  // Special-permission rules (enforced before any DB write):
  // - `roles` is Owner-exclusive and can never be granted to a configurable role.
  // - `pos` is Cashier-only and cannot be granted to Manager or Clerk.
  if (cleaned.some((key) => OWNER_ONLY_PERMISSIONS.has(key))) {
    throw new Error("Roles & Access is Owner-only and cannot be granted to another role.");
  }
  if (role !== "cashier" && cleaned.includes("pos")) {
    throw new Error("POS Register & sales is Cashier-only and cannot be granted to this role.");
  }

  await withDbTransaction(async (client) => {
    await client.query(`delete from public.role_permissions where role = $1::public.user_role`, [
      role,
    ]);
    for (const key of cleaned) {
      await client.query(
        `insert into public.role_permissions (role, permission) values ($1::public.user_role, $2)
         on conflict do nothing`,
        [role, key],
      );
    }
  });
}

/** Lists staff accounts (profiles holding at least one staff role). */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
  if (!isPostgresConfigured()) {
    return [];
  }

  await ensureRoleDefinitionSchema();

  const { rows } = await dbQuery<{
    id: string;
    full_name: string;
    email: string;
    roles: Array<UserRole | null> | null;
  }>(
    `
      select
        p.id,
        p.full_name,
        p.email,
        array_remove(array_agg(distinct ur.role), null)::text[] as roles
      from public.profiles p
      join public.user_roles ur on ur.profile_id = p.id
      group by p.id, p.full_name, p.email
      having bool_or(ur.role::text <> 'customer')
      order by p.full_name asc
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    roles: (row.roles ?? []).filter((role): role is UserRole => Boolean(role)),
  }));
}

/** Replaces the assigned roles for a profile, with lockout protection. */
export async function setUserRoles(profileId: string, roles: UserRole[]) {
  if (!isPostgresConfigured()) {
    throw new Error("Editing user roles requires the PostgreSQL backend.");
  }

  await ensureRoleDefinitionSchema();
  const assignableRoles = new Set(
    (await listRoleDefinitions())
      .filter((role) => role.kind !== "none")
      .map((role) => role.role),
  );
  const cleaned = Array.from(new Set(roles)).filter((role) => assignableRoles.has(role));
  if (cleaned.length === 0) {
    throw new Error("A staff account must keep at least one role.");
  }

  // Prevent removing the last remaining admin in the system.
  const wasAdmin = await dbQuery<{ exists: boolean }>(
    `select exists(select 1 from public.user_roles where profile_id = $1 and role = 'admin') as exists`,
    [profileId],
  );
  const losingAdmin = wasAdmin.rows[0]?.exists && !cleaned.includes("admin");
  if (losingAdmin) {
    const { rows } = await dbQuery<{ count: string }>(
      `select count(*)::text as count from public.user_roles where role = 'admin'`,
    );
    if (Number(rows[0]?.count ?? "0") <= 1) {
      throw new Error("Cannot remove the last administrator.");
    }
  }

  await withDbTransaction(async (client) => {
    await client.query(`delete from public.user_roles where profile_id = $1`, [profileId]);
    for (const role of cleaned) {
      await client.query(
        `insert into public.user_roles (profile_id, role) values ($1, $2::public.user_role)
         on conflict (profile_id, role) do nothing`,
        [profileId, role],
      );
    }
  });
}

async function ensureRoleDefinitionSchema() {
  if (ensuredRoleDefinitionSchema) {
    return;
  }

  if (ensureRoleDefinitionSchemaPromise) {
    return ensureRoleDefinitionSchemaPromise;
  }

  ensureRoleDefinitionSchemaPromise = ensureRoleDefinitionSchemaOnce().catch((error) => {
    ensureRoleDefinitionSchemaPromise = null;
    throw error;
  });

  return ensureRoleDefinitionSchemaPromise;
}

async function ensureRoleDefinitionSchemaOnce() {
  await dbQuery(`
    create table if not exists public.app_roles (
      role public.user_role primary key,
      label text not null check (char_length(trim(label)) between 2 and 60),
      description text not null default '',
      kind text not null default 'editable' check (kind in ('full', 'none', 'editable')),
      is_system boolean not null default false,
      is_active boolean not null default true,
      created_at timestamptz not null default timezone('utc', now()),
      updated_at timestamptz not null default timezone('utc', now())
    )
  `);

  await dbQuery(`
    alter table public.app_roles
    add column if not exists is_active boolean not null default true
  `);

  await dbQuery(`
    insert into public.app_roles (role, label, description, kind, is_system, is_active) values
      ('admin', 'Owner', 'Full access to everything.', 'full', true, true),
      ('manager', 'Manager', 'Reports, analytics, and orders.', 'editable', true, true),
      ('clerk', 'Inventory Clerk', 'Products, categories, and stock.', 'editable', true, true),
      ('cashier', 'Cashier', 'POS register and sales.', 'editable', true, true),
      ('customer', 'Customer', 'Storefront only - no back-office access.', 'none', true, true)
    on conflict (role) do update
      set label = excluded.label,
          description = excluded.description,
          kind = excluded.kind,
          is_system = true,
          is_active = true,
          updated_at = timezone('utc', now())
  `);

  await dbQuery(`
    insert into public.app_roles (role, label, description, kind, is_system, is_active)
    select
      role_value::public.user_role,
      initcap(replace(role_value::text, '_', ' ')),
      'Custom back-office role.',
      'editable',
      false,
      true
    from unnest(enum_range(null::public.user_role)) as roles(role_value)
    on conflict (role) do nothing
  `);

  ensuredRoleDefinitionSchema = true;
}

function sortRoleDefinitions(roles: RoleDefinition[]) {
  return [...roles].sort((a, b) => {
    const aOrder = SYSTEM_ROLE_ORDER.get(a.role) ?? 100;
    const bOrder = SYSTEM_ROLE_ORDER.get(b.role) ?? 100;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.label.localeCompare(b.label);
  });
}

function normalizeRoleLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeRoleDescription(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 160) ?? "";
}

function slugifyRole(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function quoteSqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
