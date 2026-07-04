import { cache } from "react";
import { isPostgresConfigured } from "@/lib/env";
import { dbQuery } from "@/lib/db/postgres";
import type { RoleDefinition, UserRole } from "@/types/domain";

/**
 * Catalog of admin-area resources whose access is configurable per role.
 * Each permission key maps to the route(s) it protects. Admins always have
 * every permission; the storefront (customer) and POS register (cashier) are
 * governed by their base roles and are not part of this editable matrix.
 */
export interface PermissionDefinition {
  key: string;
  label: string;
  /** Exact route or route prefix this permission protects. */
  path: string;
  /** When true, only an exact pathname match requires this permission. */
  exact?: boolean;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: "pos", label: "POS Register & sales", path: "/pos" },
  { key: "dashboard", label: "Dashboard (overview)", path: "/admin", exact: true },
  { key: "products", label: "Products", path: "/admin/products" },
  { key: "categories", label: "Categories", path: "/admin/categories" },
  { key: "inventory", label: "Inventory", path: "/admin/inventory" },
  { key: "suppliers", label: "Suppliers", path: "/admin/suppliers" },
  { key: "orders", label: "Orders", path: "/admin/orders" },
  { key: "customers", label: "Customers", path: "/admin/customers" },
  { key: "reports", label: "Reports", path: "/admin/reports" },
  { key: "comparison", label: "Comparison", path: "/admin/comparison" },
  { key: "employees", label: "Employees", path: "/admin/employees" },
  { key: "settings", label: "Settings", path: "/admin/settings" },
  { key: "roles", label: "Roles & Access", path: "/admin/roles" },
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

export const BUILT_IN_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "admin",
    label: "Owner",
    description: "Full access to everything.",
    kind: "full",
    isSystem: true,
  },
  {
    role: "manager",
    label: "Manager",
    description: "Reports, analytics, and orders.",
    kind: "editable",
    isSystem: true,
  },
  {
    role: "clerk",
    label: "Inventory Clerk",
    description: "Products, categories, and stock.",
    kind: "editable",
    isSystem: true,
  },
  {
    role: "cashier",
    label: "Cashier",
    description: "POS register and sales.",
    kind: "editable",
    isSystem: true,
  },
  {
    role: "customer",
    label: "Customer",
    description: "Storefront only - no back-office access.",
    kind: "none",
    isSystem: true,
  },
];

/** Roles whose permissions can be edited by an admin. */
export const CONFIGURABLE_ROLES: UserRole[] = ["manager", "clerk", "cashier"];

/**
 * Special permissions that break out of the standard configurable model.
 * - OWNER_EXCLUDED: keys the Owner does NOT implicitly receive (POS is
 *   cashier-only, so an Owner without the cashier role cannot enter POS).
 * - OWNER_ONLY: keys granted ONLY to the Owner and never to a configurable
 *   role (the Roles & Access page is Owner-exclusive).
 */
export const OWNER_EXCLUDED_PERMISSIONS = new Set<string>(["pos"]);
export const OWNER_ONLY_PERMISSIONS = new Set<string>(["roles"]);

/** Built-in defaults, used as a fallback if the table is unavailable. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  manager: ["reports", "comparison", "orders"],
  clerk: ["products", "categories", "inventory"],
  cashier: ["pos"],
};

/** Preferred landing order when computing a limited role's home page. */
const HOME_PRIORITY = [
  "dashboard",
  "products",
  "inventory",
  "categories",
  "reports",
  "comparison",
  "orders",
  "suppliers",
  "customers",
  "employees",
  "settings",
  "roles",
];

/**
 * Loads role -> permission keys from the database. Falls back to built-in
 * defaults only when the backing table cannot be read (e.g. not migrated yet).
 */
export const getRolePermissionMap = cache(async (): Promise<Map<string, Set<string>>> => {
  const map = new Map<string, Set<string>>();

  if (!isPostgresConfigured()) {
    for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      map.set(role, new Set(keys));
    }
    return map;
  }

  try {
    const { rows } = await dbQuery<{ role: string; permission: string }>(
      `
        select rp.role::text as role, rp.permission
        from public.role_permissions rp
        left join public.app_roles ar on ar.role = rp.role
        where coalesce(ar.is_active, true) = true
      `,
    );
    for (const row of rows) {
      const existing = map.get(row.role) ?? new Set<string>();
      existing.add(row.permission);
      map.set(row.role, existing);
    }
    return map;
  } catch {
    for (const [role, keys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      map.set(role, new Set(keys));
    }
    return map;
  }
});

/**
 * Returns the set of permission keys a user holds.
 * - The Owner (admin) receives every permission EXCEPT owner-excluded keys
 *   (POS), so the Owner cannot enter POS mode unless they also hold cashier.
 * - `pos` is granted only through the cashier role; `roles` only through the
 *   owner. Owner-only keys are filtered out of any configurable-role grant as
 *   defense in depth, so a stray DB row can never leak them.
 */
export async function getPermissionsForRoles(roles: UserRole[]): Promise<Set<string>> {
  const granted = new Set<string>();

  if (roles.includes("admin")) {
    for (const key of ALL_PERMISSION_KEYS) {
      if (!OWNER_EXCLUDED_PERMISSIONS.has(key)) {
        granted.add(key);
      }
    }
  }

  const map = await getRolePermissionMap();
  for (const role of roles) {
    if (role === "admin") {
      continue;
    }
    const perms = map.get(role);
    if (!perms) {
      continue;
    }
    for (const key of perms) {
      if (OWNER_ONLY_PERMISSIONS.has(key)) {
        continue;
      }
      granted.add(key);
    }
  }

  return granted;
}

/**
 * Determines which permission key a given pathname requires.
 * Unknown /admin paths fall back to "dashboard" (admin-only) to stay safe.
 */
export function permissionForPathname(pathname: string): string | null {
  for (const def of PERMISSION_CATALOG) {
    if (def.exact) {
      continue;
    }
    if (pathname === def.path || pathname.startsWith(`${def.path}/`)) {
      return def.key;
    }
  }

  if (pathname === "/admin" || pathname.startsWith("/admin")) {
    return "dashboard";
  }

  return null;
}

/** Picks a safe landing page for a non-admin staff member from their grants. */
export function resolveStaffHome(permissions: Set<string>, roles: UserRole[]): string {
  if (roles.includes("admin")) {
    return "/admin";
  }

  for (const key of HOME_PRIORITY) {
    if (permissions.has(key)) {
      const def = PERMISSION_CATALOG.find((p) => p.key === key);
      if (def) {
        return def.path;
      }
    }
  }

  if (permissions.has("pos")) {
    return "/pos";
  }

  // No granted workspace -> fall back to the public storefront.
  return "/shop";
}

/** Maps an admin nav href to its permission key (for nav filtering). */
export function permissionForNavHref(href: string): string | null {
  return permissionForPathname(href);
}
