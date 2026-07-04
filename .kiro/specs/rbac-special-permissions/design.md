# Design Document

## Overview

This feature introduces two "special" permission rules on top of the existing configurable RBAC system, without changing the database schema or the general permission-resolution model for every other key.

1. **`pos` becomes Cashier-exclusive.** Today the Owner (`admin` role) auto-receives every permission key, so `getPermissionsForRoles` returns `new Set(ALL_PERMISSION_KEYS)` for admins — which includes `pos`. This must change: `pos` is granted **only** through the Cashier role, and the Owner no longer receives it implicitly. An Owner without the Cashier role cannot enter POS mode, sees no POS nav link, and is redirected to `/admin` when hitting any `/pos` route.
2. **`roles` becomes Owner-exclusive.** The `roles` permission (protecting `/admin/roles` and its mutating actions) is granted **only** to the Owner and can never be persisted for a Configurable_Role, even if the matrix payload tries to include it.

The design keeps `pos` and `roles` as rows in the permission catalog and the matrix UI, but presents them as locked/special entries. It also removes the "admin bypass" shortcuts (`requirePermission`'s early return and the `getPermissionsForRoles` all-keys shortcut) so that the Owner's `pos` exclusion is honored uniformly, while ensuring the Owner still reaches every other admin page. Redirect-loop safety is preserved via `resolveStaffHome`, with Owner-from-`/pos` always landing on `/admin`.

The change is deliberately narrow. It touches permission resolution (`lib/auth/permissions.ts`), the permission guard (`lib/auth/guards.ts`), matrix-save validation (`lib/services/access.ts`), the `/admin/roles` page and its action gating (`app/(dashboard)/admin/roles/page.tsx`, `app/actions/access.ts`), and the matrix UI (`components/dashboard/role-permissions-editor.tsx`). No application code is modified in this design phase.

**Requirements coverage:** R1 (Cashier-exclusive `pos`), R2 (Owner excluded from POS), R3 (Owner-exclusive `roles`), R4 (matrix presentation), R5 (redirect-loop safety).

## Architecture

The system has three cooperating enforcement layers. The special-permission rules are all expressed by changing how the **permission set** is computed and validated; the enforcement layers themselves keep their existing shape.

```mermaid
flowchart TD
    subgraph Resolution["Permission Resolution (lib/auth/permissions.ts)"]
        A[roles: UserRole array] --> B{getPermissionsForRoles}
        B -->|owner| C[ALL_PERMISSION_KEYS<br/>minus OWNER_EXCLUDED (pos)<br/>plus OWNER_ONLY (roles)]
        B -->|cashier| D[grant pos]
        B -->|manager/clerk| E[matrix keys only<br/>never pos, never roles]
        C --> F[Resolved permission Set]
        D --> F
        E --> F
    end

    subgraph Enforce["Enforcement"]
        F --> G[Layout guards<br/>admin/layout, pos/layout]
        F --> H[requirePermission key]
        F --> I[Nav filtering<br/>allowedNavHrefs]
    end

    subgraph Save["Matrix Save Validation (lib/services/access.ts)"]
        J[setRolePermissions role, permissions] --> K{reject pos on non-cashier?<br/>reject roles on any configurable?}
        K -->|invalid| L[throw Error - no DB write]
        K -->|valid| M[persist role_permissions]
    end

    G -->|missing perm| N[resolveStaffHome]
    H -->|missing perm| N
    N -->|owner from /pos| O[/admin]
    N -->|no workspace| P[/shop]
```

The key architectural decision is to make the permission **set** the single source of truth. Every guard consults the resolved set instead of special-casing the `admin` role. This removes the two "admin shortcut" code paths that currently let the Owner reach POS.

### Permission resolution model

`getPermissionsForRoles(roles)` is reworked around two explicit constant sets:

- `OWNER_EXCLUDED_PERMISSIONS = new Set(["pos"])` — keys the Owner does **not** implicitly receive.
- `OWNER_ONLY_PERMISSIONS = new Set(["roles"])` — keys granted **only** to the Owner and never to a Configurable_Role.

Resolution becomes additive across roles:

1. Start with an empty set.
2. If `roles` includes `admin`: add every key in `ALL_PERMISSION_KEYS` **except** those in `OWNER_EXCLUDED_PERMISSIONS`. This yields all keys minus `pos`, and includes `roles`.
3. For each non-admin role, add the keys from the role-permission map (DB-backed, defaults as fallback). The map for Cashier includes `pos` (already seeded). Manager/Clerk never contain `pos` or `roles` because save-validation rejects them.
4. `pos` therefore appears in the resolved set **iff** the account holds the Cashier role (regardless of any other role, including Owner — see Design Decision D3).
5. `roles` appears in the resolved set **iff** the account holds the Owner role (Owner-only), because it is granted through the owner branch and can never be stored for a configurable role.

This makes an Owner+Cashier account resolve to (all keys except `pos`) ∪ (Cashier's keys including `pos`) = every key including both `pos` and `roles`, which matches D3.

## Components and Interfaces

### 1. `lib/auth/permissions.ts` — resolution + new constants (R1.1, R1.2, R2.1, R3.1, R3.2)

Add exported constants and rewrite `getPermissionsForRoles`:

```ts
/** Keys the Owner does NOT implicitly receive (special exclusions). */
export const OWNER_EXCLUDED_PERMISSIONS = new Set<string>(["pos"]);

/** Keys granted ONLY to the Owner; never assignable to a Configurable_Role. */
export const OWNER_ONLY_PERMISSIONS = new Set<string>(["roles"]);

export async function getPermissionsForRoles(roles: UserRole[]): Promise<Set<string>> {
  const granted = new Set<string>();

  if (roles.includes("admin")) {
    for (const key of ALL_PERMISSION_KEYS) {
      if (!OWNER_EXCLUDED_PERMISSIONS.has(key)) {
        granted.add(key); // all keys except pos; includes `roles`
      }
    }
  }

  const map = await getRolePermissionMap();
  for (const role of roles) {
    if (role === "admin") continue;
    const perms = map.get(role);
    if (!perms) continue;
    for (const key of perms) {
      // Defense in depth: a configurable role can never contribute owner-only keys.
      if (OWNER_ONLY_PERMISSIONS.has(key)) continue;
      granted.add(key); // Cashier contributes `pos` here
    }
  }

  return granted;
}
```

Notes:
- `pos` is only ever added via a non-admin role that holds it (Cashier). The admin branch skips it.
- `roles` is only ever added via the admin branch; the configurable loop filters `OWNER_ONLY_PERMISSIONS` so even a corrupt DB row cannot grant `roles` to Manager/Clerk/Cashier.
- `resolveStaffHome`, `permissionForPathname`, `PERMISSION_CATALOG`, `ALL_PERMISSION_KEYS`, and `CONFIGURABLE_ROLES` are unchanged. `resolveStaffHome` already returns `/admin` for admins and falls back to `/shop`, satisfying R5.

### 2. `lib/auth/guards.ts` — remove admin bypass in `requirePermission` (R2.2, R2.4, R2.5, R3.5)

The current early return lets any admin pass every `requirePermission` check, which is exactly why an Owner can currently reach `/pos`. Rework it to always consult the resolved set:

```ts
export async function requirePermission(permission: string, redirectTo?: string) {
  const profile = await requireUser(redirectTo);
  const permissions = await getPermissionsForRoles(profile.roles);
  if (!permissions.has(permission)) {
    redirect(resolveStaffHome(permissions, profile.roles));
  }
  return profile;
}
```

Behavior:
- An Owner (no Cashier) calling `requirePermission("pos", ...)` lacks `pos` → redirected to `resolveStaffHome(perms, ["admin"])` = `/admin` (exactly one redirect; R2.5, R5.4). Since `/admin` requires `dashboard`, which the Owner holds, no further redirect occurs.
- An Owner still passes every other `requirePermission(...)` check because the resolved set contains all keys except `pos`.
- POS server actions (`openPosShiftAction`, `closePosShiftAction`, `posCheckoutAction`, `updateOnlineOrderStatusAction`, `getOnlineOrders`) already call `requirePermission("pos", ...)`; with the bypass removed they now deny the Owner and redirect to `/admin` before any state change (R2.4).

### 3. `app/(dashboard)/pos/layout.tsx` — Owner redirect entry point (R2.2, R2.5, R5.4)

`PosLayout` already opens with `await requirePermission("pos", "/pos")`. With the reworked guard, an Owner-without-Cashier is redirected to `/admin` before any POS content renders. `allowedNavHrefs` is already derived from `permissions.has("pos")`, so an Owner who somehow reaches the shell sees no POS links. No structural change is required here beyond the guard rework; this file is documented as the redirect entry point.

### 4. `app/(dashboard)/admin/layout.tsx` — keep Owner reaching all admin pages (R2.3, R3.6, R5)

The admin layout currently short-circuits per-path checks with `if (!isAdmin)`. Because the reworked `getPermissionsForRoles` gives the Owner every admin key (all keys except `pos`, plus `roles`), the layout continues to allow the Owner into every `/admin/*` page. Two adjustments:
- `allowedNavHrefs` for the Owner should be derived from the resolved permission set (same as non-admins) rather than the entire catalog, so the POS link is omitted for an Owner lacking `pos` and the Roles link appears only when `roles` is present. Concretely, drop the `isAdmin ? PERMISSION_CATALOG.map(...)` branch and always compute `PERMISSION_CATALOG.filter((def) => permissions.has(def.key)).map((def) => def.path)`.
- The per-path enforcement block may keep the `isAdmin` fast-path for `/admin/*` pages (the Owner holds all admin keys anyway), but it MUST NOT be used to grant `pos`. Since `/pos` is enforced by `PosLayout`, the admin layout never needs to grant `pos`.

### 5. `lib/services/access.ts` — matrix-save validation (R1.3, R1.4, R1.5, R3.4)

`setRolePermissions(role, permissions)` gains special-permission validation after the existing `CONFIGURABLE_ROLES` and `ALL_PERMISSION_KEYS` checks and before the transaction:

```ts
// Reject owner-only permissions on any configurable role.
if (cleaned.some((key) => OWNER_ONLY_PERMISSIONS.has(key))) {
  throw new Error("The Roles & Access permission is Owner-exclusive and cannot be assigned to this role.");
}

// Reject pos on any non-cashier configurable role.
if (role !== "cashier" && cleaned.includes("pos")) {
  throw new Error("The POS permission is Cashier-only and cannot be granted to this role.");
}
```

- The validation runs before `withDbTransaction`, so a rejected payload never mutates `role_permissions` (R1.3, R3.4: existing grants unchanged).
- Error messages name the offending key/rule (R1.4).
- A Cashier payload containing `pos` passes and persists (R1.5).
- `setUserRoles` is unchanged; assigning the Cashier role remains the mechanism that grants `pos`.

### 6. `app/actions/access.ts` — gate on `roles` permission (R3.5)

Replace `requireRoles(["admin"], "/admin")` with a permission-based guard so both matrix actions are gated by the Owner-only `roles` key:

```ts
await requirePermission("roles", "/admin");
```

Because `roles` resolves only for the Owner, behavior is equivalent to the previous admin-only gate, but it is now expressed through the permission model (single source of truth). A caller lacking `roles` is redirected to its Staff_Home via `resolveStaffHome` with no mutation performed (R3.5).

### 7. `app/(dashboard)/admin/roles/page.tsx` — gate on `roles` permission (R3.3)

Add an explicit guard at the top of `RolesPage`:

```ts
await requirePermission("roles", "/admin");
```

A non-Owner requesting `/admin/roles` is redirected to its Staff_Home (a page it can open) before the page renders (R3.3). The Owner passes because the resolved set contains `roles`.

### 8. `components/dashboard/role-permissions-editor.tsx` — locked special entries (R4.1–R4.6)

The editor renders the configurable roles (`CONFIGURABLE_ROLES`) with a locked Owner/Customer presentation. Extend the per-key rendering so `pos` and `roles` are treated as special:

- Introduce a client-side notion of special keys mirroring the server constants: `SPECIAL_KEYS = { pos: "cashier-only", roles: "owner-only" }`.
- For the selected role, compute per-key `locked` and `reason`:
  - `roles` → always locked for every Configurable_Role; state shown as not-granted; label "Owner-exclusive".
  - `pos` → interactive only when the selected role is Cashier; locked (not-granted) for Manager/Clerk; label "Cashier-only".
- Locked entries render a disabled control and ignore toggles (`toggle` returns early when the key is locked), preventing state changes (R4.6).
- Each special key shows a visible Special_Permission indicator (e.g., a badge) distinguishing it from standard keys (R4.4) and explanatory text stating why it cannot be edited (R4.5).
- Cashier + `pos` remains a working toggle bound to the Cashier grant (R4.1). Save for Cashier still posts through `saveRolePermissionsAction`; server validation is the authority.

This is a UI presentation change layered on the existing checkbox grid; it does not replace server-side validation, which remains the enforcement of record.

### Interface summary (files to change)

| File | Change |
| --- | --- |
| `lib/auth/permissions.ts` | Add `OWNER_EXCLUDED_PERMISSIONS`, `OWNER_ONLY_PERMISSIONS`; rewrite `getPermissionsForRoles` |
| `lib/auth/guards.ts` | Remove admin early-return in `requirePermission`; always check resolved set |
| `lib/services/access.ts` | Add special-permission validation in `setRolePermissions` |
| `app/actions/access.ts` | Gate both actions with `requirePermission("roles", "/admin")` |
| `app/(dashboard)/admin/roles/page.tsx` | Add `requirePermission("roles", "/admin")` guard |
| `app/(dashboard)/admin/layout.tsx` | Derive `allowedNavHrefs` from resolved set for all users; never grant `pos` |
| `app/(dashboard)/pos/layout.tsx` | Redirect entry point (behavior via reworked guard); no structural change |
| `components/dashboard/role-permissions-editor.tsx` | Render `pos`/`roles` as locked special entries with indicators + text |

## Data Models

**No database schema change.** The `role_permissions` table is unchanged, and the Cashier role is already seeded with the `pos` grant. The special rules are enforced entirely in application logic:

- `pos` continues to live as a `role_permissions` row for Cashier; it is simply never granted to the Owner implicitly and never savable for Manager/Clerk.
- `roles` is intentionally **not** stored in `role_permissions` for any configurable role. It is derived at resolution time for the Owner only. Save-validation rejects any attempt to persist it for a configurable role, and the resolution loop filters it as defense in depth.

Conceptual permission-resolution model:

```
resolved(account) =
    (account.hasRole(admin)  ? ALL_KEYS \ {pos}          : ∅)
  ∪ (account.hasRole(admin)  ? {roles}                    : ∅)   // via ALL_KEYS above
  ∪ ⋃ over non-admin roles r: (matrixKeys(r) \ OWNER_ONLY)
```

Where `matrixKeys(cashier) ⊇ {pos}`. This yields:
- `pos ∈ resolved(account)  ⇔  account.hasRole(cashier)`
- `roles ∈ resolved(account)  ⇔  account.hasRole(admin)`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Permission resolution and matrix-save validation are pure, input-varying functions over `(roles, matrix, payload)`, so they are well suited to property-based testing. UI presentation (R4), route-level redirects (R2.2, R2.4, R3.3, R3.5), and nav-link omission (R2.3, R3.6) are covered by example, edge-case, and integration tests in the Testing Strategy instead.

The properties below were consolidated from the prework to remove redundancy (the `pos`/`roles` biconditionals each merge two acceptance criteria; the two illegal-save rules merge into one; the loop-safety criteria merge into one comprehensive property).

### Property 1: `pos` is granted if and only if the account holds Cashier

*For any* array of roles (including arbitrary combinations of `admin`, `manager`, `clerk`, `cashier`) resolved against any role-permission matrix in which Cashier holds `pos`, the resolved permission set contains `pos` **if and only if** the role array includes `cashier`. In particular, an account holding `admin` but not `cashier` resolves to a set that excludes `pos` while still including its other Owner keys (e.g. `dashboard`, `roles`).

**Validates: Requirements 1.1, 1.2, 2.1**

### Property 2: `roles` is granted if and only if the account holds Owner

*For any* array of roles resolved against any role-permission matrix — including a matrix corrupted to contain `roles` for a Configurable_Role — the resolved permission set contains `roles` **if and only if** the role array includes `admin`. A Configurable_Role can never contribute `roles` to the resolved set.

**Validates: Requirements 3.1, 3.2**

### Property 3: Illegal special-key submissions are rejected and leave stored grants unchanged

*For any* Configurable_Role and any permission payload that contains an illegal special key for that role — `pos` submitted for Manager or Clerk, or `roles` submitted for any of Manager, Clerk, or Cashier — `setRolePermissions` rejects the submission by throwing an error and performs no write, so the stored permission grants for that role are identical before and after the attempt.

**Validates: Requirements 1.3, 1.4, 3.4**

### Property 4: Cashier `pos` submissions persist (save round-trip)

*For any* valid permission payload for the Cashier role that includes `pos` (with any combination of other valid keys), `setRolePermissions` accepts the submission, and a subsequent read of the Cashier role's grants includes `pos`.

**Validates: Requirements 1.5**

### Property 5: Every redirect target is accessible and terminates in one hop

*For any* account (any role array) with its resolved permission set, the redirect target chosen by `resolveStaffHome` is either a public route requiring no permission key (`/shop`) or a route whose required permission key is present in that account's resolved set; therefore requesting the target again produces no further access redirect. In particular, an Owner redirected away from `/pos` lands on `/admin` (whose required `dashboard` key the Owner always holds), and an account with no accessible workspace lands on `/shop`.

**Validates: Requirements 2.5, 5.1, 5.2, 5.3, 5.4**

## Error Handling

- **Illegal matrix save (`pos` on non-Cashier, `roles` on any configurable role):** `setRolePermissions` throws a descriptive `Error` before opening the DB transaction, so no rows are deleted or inserted. `saveRolePermissionsAction` catches it and returns `{ ok: false, message }`, which the editor surfaces inline (R1.3, R1.4, R3.4). The client also locks these entries so the payload should never contain them in normal use; the server check is the authoritative backstop.
- **Owner navigating to `/pos`:** `requirePermission("pos", "/pos")` in `PosLayout` finds `pos` absent and issues exactly one `redirect(resolveStaffHome(...))` → `/admin`. Next.js `redirect()` throws a control-flow signal that halts rendering, guaranteeing no POS content is produced (R2.2, R2.5).
- **Non-Owner invoking a Roles action or opening `/admin/roles`:** `requirePermission("roles", ...)` redirects to Staff_Home before any mutation runs; the mutating service functions are never reached (R3.3, R3.5).
- **Missing/unauthenticated session:** unchanged — `requireUser` redirects to `/login` with a `redirectTo`.
- **DB unavailable for permission map:** `getRolePermissionMap` already falls back to `DEFAULT_ROLE_PERMISSIONS` (Cashier → `pos`), so the biconditionals still hold offline. `setRolePermissions` still guards on `isPostgresConfigured()` and throws a clear message when persistence is unavailable.
- **Loop safety:** because every redirect target is validated against the resolved set (Property 5), no rejection path can select an inaccessible target, so no redirect loop can form (R5).

## Testing Strategy

### Property-based tests

Use the project's JavaScript/TypeScript ecosystem PBT library **fast-check** with the existing test runner. Do not hand-roll generators framework code. Each property test:
- Runs a minimum of **100 iterations**.
- Is tagged with a comment referencing its design property in the form
  `// Feature: rbac-special-permissions, Property N: <property text>`.
- Implements exactly one of Properties 1–5 above.

Generators:
- **Role arrays:** arbitrary non-empty subsets of `["admin","manager","clerk","cashier","customer"]` (with and without `cashier`/`admin`) to exercise Properties 1, 2, and 5.
- **Permission matrices:** maps from role → arbitrary subset of `ALL_PERMISSION_KEYS`, plus a fault-injection variant that seeds `roles`/`pos` into configurable roles to prove resolution filtering (Property 2) and save rejection (Property 3).
- **Save payloads:** arbitrary key subsets, conditionally including the illegal special key, for Property 3; arbitrary valid subsets that include `pos` for the Cashier round-trip (Property 4). Persistence is exercised through an in-memory/mocked `role_permissions` store so 100+ iterations stay fast and deterministic.

### Unit / example tests

- R1.4 error message content (names the `pos`/Cashier rule) and R3.4 error message content (names the Owner-exclusive `roles` rule).
- R2.3 and R3.6 nav filtering: given a resolved set lacking `pos` (resp. `roles`), `allowedNavHrefs` excludes `/pos` (resp. `/admin/roles`).
- R4.1–R4.5 editor rendering: Cashier shows an interactive `pos` toggle; Manager/Clerk show `pos` locked + "Cashier-only"; all configurable roles show `roles` locked + "Owner-exclusive"; special indicators and explanatory text are present.
- R4.6 (edge case): clicking a locked `pos`/`roles` entry does not change matrix state.
- R5.3 (edge case): an account with no granted workspace resolves `resolveStaffHome` to `/shop`.

### Integration tests (1–3 examples each)

- R2.2 / R2.4: Owner-without-Cashier hitting `/pos` and `/pos/history`, and invoking a POS action (e.g. `posCheckoutAction`), redirects to `/admin` with no state change.
- R3.3 / R3.5: non-Owner requesting `/admin/roles` and invoking `saveRolePermissionsAction` / `setUserRolesAction` is redirected to Staff_Home with no mutation.
- Owner + Cashier combined account (D3): retains `pos` and reaches `/pos`.

## Design Decisions

- **D1/D2 — `pos` is strictly Cashier-only and the Owner cannot use POS.** Enforced by excluding `pos` from the Owner branch (`OWNER_EXCLUDED_PERMISSIONS`) and granting it only through the Cashier matrix row. The admin bypass in `requirePermission` is removed so the exclusion is actually honored at the guard level.
- **D3 — POS access is role-scoped, not person-scoped.** An account holding **both** Owner and Cashier keeps `pos` through its Cashier role, because resolution is additive: the Owner branch omits `pos`, but the Cashier branch adds it. Property 1 encodes this as "`pos` iff `cashier`", independent of other roles. If policy later requires Owner to hard-block POS even with Cashier, only the Owner branch (or a post-filter) changes; the property would flip to "`pos` iff (`cashier` and not `admin`)".
- **D4 — `roles` is Owner-only and never editable.** Granted solely via the Owner branch; filtered out of the configurable contribution as defense in depth; rejected at save time; and rendered locked in the matrix.
- **D5 — Owner-from-POS redirect target is `/admin`.** `resolveStaffHome` returns `/admin` for admins, a route the Owner can always open (holds `dashboard`), guaranteeing single-hop termination.
- **Gate Roles actions on the `roles` permission instead of `requireRoles(["admin"])`.** Since `roles` resolves only for the Owner, behavior is equivalent, but expressing it through the permission set keeps a single source of truth and lets Property 5 reason uniformly about redirect targets.
- **D6 — Fallbacks preserved.** `resolveStaffHome` retains its `/shop` fallback, and Property 5 proves every rejection path lands on an accessible target, so no redirect loops are introduced.

### Requirements-to-design traceability

| Requirement | Addressed by |
| --- | --- |
| R1 (Cashier-exclusive `pos`) | `getPermissionsForRoles` rework, `setRolePermissions` validation; Properties 1, 3, 4 |
| R2 (Owner excluded from POS) | `requirePermission` rework, `PosLayout` guard, nav filtering; Properties 1, 5 + integration tests |
| R3 (Owner-exclusive `roles`) | `getPermissionsForRoles` owner branch + filter, `setRolePermissions` validation, `roles` page + action gating; Properties 2, 3 + integration tests |
| R4 (matrix presentation) | `role-permissions-editor.tsx` locked special entries; example/edge tests |
| R5 (redirect-loop safety) | `resolveStaffHome` (unchanged) validated by Property 5 |
