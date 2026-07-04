# Implementation Plan: RBAC Special Permissions

## Overview

This plan implements two special-permission rules on top of the existing configurable RBAC system, following the design exactly:

- `pos` becomes Cashier-exclusive (granted iff the account holds `cashier`; the Owner no longer receives it implicitly).
- `roles` becomes Owner-exclusive (granted iff the account holds `admin`; never assignable to a Configurable_Role).

Work proceeds bottom-up: permission resolution first (the single source of truth), then the guard, then save-validation, then the action/page/layout gating, then the matrix UI, then integration tests and a one-off data cleanup. Property-based tests use fast-check (min 100 iterations) and implement the 5 correctness properties from the design. Each task references the requirement clauses and/or property numbers it satisfies.

## Tasks

- [ ] 1. Set up the test runner and property-based testing tooling
  - Add `vitest` and `fast-check` as dev dependencies and a `test` script (`vitest --run`) plus a `test:watch` script to `package.json`
  - Add a minimal `vitest.config.ts` that resolves the `@/` path alias (mirroring `tsconfig.json` paths) so tests can import project modules
  - Create a `tests/` (or `__tests__/`) directory convention for the spec's tests
  - Do not add any application logic here; this task only enables running unit, example, and property tests
  - _Requirements: supports all (test infrastructure)_

- [ ] 2. Rework permission resolution in `lib/auth/permissions.ts`
  - [ ] 2.1 Add special-permission constants and rewrite `getPermissionsForRoles`
    - Export `OWNER_EXCLUDED_PERMISSIONS = new Set<string>(["pos"])` and `OWNER_ONLY_PERMISSIONS = new Set<string>(["roles"])`
    - Rewrite `getPermissionsForRoles(roles)` to be additive: for `admin`, add every key in `ALL_PERMISSION_KEYS` except those in `OWNER_EXCLUDED_PERMISSIONS` (so no `pos`, keeps `roles`); for each non-admin role, add its matrix keys but skip any key in `OWNER_ONLY_PERMISSIONS`
    - Result: `pos ∈ set ⇔ roles include cashier`; `roles ∈ set ⇔ roles include admin`
    - Leave `resolveStaffHome`, `permissionForPathname`, `PERMISSION_CATALOG`, `ALL_PERMISSION_KEYS`, `CONFIGURABLE_ROLES` unchanged
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2_

  - [ ]* 2.2 Write property test for POS resolution
    - **Property 1: `pos` is granted if and only if the account holds Cashier**
    - Generate arbitrary non-empty role subsets of `["admin","manager","clerk","cashier","customer"]` against a matrix where Cashier holds `pos`; assert `resolved.has("pos") === roles.includes("cashier")`, and that an admin-without-cashier still holds other Owner keys (e.g. `dashboard`, `roles`)
    - min 100 iterations; tag `// Feature: rbac-special-permissions, Property 1: ...`
    - **Validates: Requirements 1.1, 1.2, 2.1**

  - [ ]* 2.3 Write property test for `roles` resolution
    - **Property 2: `roles` is granted if and only if the account holds Owner**
    - Include a fault-injected matrix that seeds `roles` into a Configurable_Role; assert `resolved.has("roles") === roles.includes("admin")` regardless, proving the configurable contribution is filtered
    - min 100 iterations; tag `// Feature: rbac-special-permissions, Property 2: ...`
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 2.4 Write example/edge test for `resolveStaffHome` `/shop` fallback
    - Assert an account whose resolved set grants no workspace resolves `resolveStaffHome` to `/shop`
    - _Requirements: 5.3_

- [ ] 3. Remove the admin bypass in `lib/auth/guards.ts`
  - [ ] 3.1 Rework `requirePermission` to always consult the resolved set
    - Delete the `if (profile.roles.includes("admin")) return profile;` early return
    - Always compute `getPermissionsForRoles(profile.roles)` and, when the key is absent, `redirect(resolveStaffHome(permissions, profile.roles))`
    - This makes an Owner-without-Cashier be denied `pos` and redirected to `/admin` in exactly one hop
    - _Requirements: 2.2, 2.4, 2.5, 3.5_

  - [ ]* 3.2 Write property test for redirect-target safety
    - **Property 5: Every redirect target is accessible and terminates in one hop**
    - For any role array and its resolved set, assert the target chosen by `resolveStaffHome` is `/shop` (public, no key) or a route whose required key (`permissionForPathname(target)`) is in the resolved set; assert an Owner-from-`/pos` lands on `/admin` and that `/admin`'s key (`dashboard`) is present
    - min 100 iterations; tag `// Feature: rbac-special-permissions, Property 5: ...`
    - **Validates: Requirements 2.5, 5.1, 5.2, 5.3, 5.4**

- [ ] 4. Add special-permission save validation in `lib/services/access.ts`
  - [ ] 4.1 Reject illegal special keys in `setRolePermissions`
    - Import `OWNER_ONLY_PERMISSIONS` from `lib/auth/permissions.ts`
    - After the existing `CONFIGURABLE_ROLES`/`ALL_PERMISSION_KEYS` checks and before `withDbTransaction`: if the cleaned payload contains any `OWNER_ONLY_PERMISSIONS` key, throw a descriptive error naming the Owner-exclusive `roles` rule; if `role !== "cashier"` and the payload includes `pos`, throw a descriptive error naming the Cashier-only `pos` rule
    - Validation must run before any DB write so a rejected payload leaves stored grants unchanged
    - _Requirements: 1.3, 1.4, 3.4_

  - [ ]* 4.2 Write property test for illegal special-key rejection
    - **Property 3: Illegal special-key submissions are rejected and leave stored grants unchanged**
    - Using an in-memory/mocked `role_permissions` store, generate payloads that inject an illegal special key (`pos` for Manager/Clerk, or `roles` for Manager/Clerk/Cashier); assert `setRolePermissions` throws and the stored grants for that role are identical before and after
    - min 100 iterations; tag `// Feature: rbac-special-permissions, Property 3: ...`
    - **Validates: Requirements 1.3, 1.4, 3.4**

  - [ ]* 4.3 Write property test for Cashier `pos` save round-trip
    - **Property 4: Cashier `pos` submissions persist (save round-trip)**
    - Generate valid Cashier payloads that include `pos` (plus arbitrary valid keys); assert `setRolePermissions` accepts and a subsequent read of the Cashier grants includes `pos`
    - min 100 iterations; tag `// Feature: rbac-special-permissions, Property 4: ...`
    - **Validates: Requirements 1.5**

  - [ ]* 4.4 Write unit tests for rejection error messages
    - Assert the `pos`-on-non-Cashier error names the `pos`/Cashier rule (R1.4) and the `roles`-on-configurable error names the Owner-exclusive `roles` rule (R3.4)
    - _Requirements: 1.4, 3.4_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Gate the Roles actions on the `roles` permission in `app/actions/access.ts`
  - [ ] 6.1 Replace role-based gate with permission-based gate
    - In both `saveRolePermissionsAction` and `setUserRolesAction`, replace `requireRoles(["admin"], "/admin")` with `requirePermission("roles", "/admin")` (update the import accordingly)
    - A caller lacking `roles` is redirected to Staff_Home before any mutation runs
    - _Requirements: 3.5_

  - [ ]* 6.2 Write integration test for action gating
    - Assert invoking `saveRolePermissionsAction` / `setUserRolesAction` as a non-Owner triggers a redirect and performs no mutation (service functions not reached)
    - _Requirements: 3.5_

- [ ] 7. Guard the Roles page in `app/(dashboard)/admin/roles/page.tsx`
  - [ ] 7.1 Add a `requirePermission` guard at the top of `RolesPage`
    - Call `await requirePermission("roles", "/admin")` before any data loading/rendering so a non-Owner is redirected to its Staff_Home; the Owner passes because the resolved set contains `roles`
    - _Requirements: 3.3_

- [ ] 8. Derive nav visibility from the resolved set in `app/(dashboard)/admin/layout.tsx`
  - [ ] 8.1 Compute `allowedNavHrefs` from the resolved permission set for all users
    - Drop the `isAdmin ? PERMISSION_CATALOG.map(...)` branch; always compute `PERMISSION_CATALOG.filter((def) => permissions.has(def.key)).map((def) => def.path)` so the POS link is hidden for an Owner lacking `pos` and the Roles link only appears with `roles`
    - Keep per-path enforcement behavior for `/admin/*`; never use the layout to grant `pos`
    - _Requirements: 2.3, 3.6_

  - [ ]* 8.2 Write unit test for nav filtering
    - Given a resolved set lacking `pos`, assert `allowedNavHrefs` excludes `/pos`; given a set lacking `roles`, assert it excludes `/admin/roles`
    - _Requirements: 2.3, 3.6_

- [ ] 9. Render locked special entries in `components/dashboard/role-permissions-editor.tsx`
  - [ ] 9.1 Implement special-key locking and indicators
    - Add a client-side `SPECIAL_KEYS = { pos: "cashier-only", roles: "owner-only" }` mirroring server constants
    - Per selected role, compute `locked`/`reason`: `roles` is always locked (not-granted, "Owner-exclusive") for every Configurable_Role; `pos` is interactive only for Cashier and locked (not-granted, "Cashier-only") for Manager/Clerk
    - Make `toggle` return early for locked keys (no-op click); render locked entries with a disabled control, a visible Special_Permission indicator badge, and explanatory text stating why they cannot be edited
    - Keep the Cashier `pos` toggle interactive and bound to the Cashier grant
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 9.2 Write unit tests for editor rendering
    - Assert Cashier shows an interactive `pos` toggle; Manager/Clerk show `pos` locked + "Cashier-only"; all configurable roles show `roles` locked + "Owner-exclusive"; special indicators and explanatory text are present
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 9.3 Write edge-case test for locked toggle no-op
    - Assert clicking a locked `pos`/`roles` entry does not change matrix state
    - _Requirements: 4.6_

- [ ] 10. Route/action integration tests for the special-permission rules
  - [ ]* 10.1 Owner-without-Cashier POS denial
    - Assert an Owner-without-Cashier hitting `/pos` (via `PosLayout`'s `requirePermission("pos", "/pos")`) and invoking a POS action (e.g. `posCheckoutAction`) redirects to `/admin` with no state change
    - _Requirements: 2.2, 2.4, 2.5_

  - [ ]* 10.2 Non-Owner Roles page/action denial
    - Assert a non-Owner requesting `/admin/roles` is redirected to Staff_Home and that Roles actions perform no mutation
    - _Requirements: 3.3, 3.5_

  - [ ]* 10.3 Owner + Cashier combined account (D3)
    - Assert an account holding both `admin` and `cashier` retains `pos` and reaches `/pos`
    - _Requirements: 1.1_

- [ ] 11. One-off data cleanup for stray `pos` grants
  - [ ] 11.1 Add a migration/SQL script removing illegal stored `pos` rows
    - Create a migration/SQL file that deletes `pos` rows from `public.role_permissions` for any non-Cashier role (e.g. `manager`, `clerk`) so existing data conforms to the new rules
    - Include a short note documenting that this is a one-off cleanup run alongside the deploy; do not delete Cashier's `pos` row
    - _Requirements: 1.2, 1.3_

- [ ] 12. Final verification
  - [ ] 12.1 Run typecheck, lint, and the full test suite
    - Run `npm run typecheck`, `npm run lint`, and `npm run test` (vitest `--run`); fix any type/lint errors and failing tests introduced by these changes
    - _Requirements: all_

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP, but they encode the design's correctness properties and testing strategy.
- Each task references specific requirement clauses (R1–R5) and, where applicable, a design property number for traceability.
- Property-based tests use fast-check with a minimum of 100 iterations and the required `// Feature: rbac-special-permissions, Property N: ...` tags.
- Checkpoints ensure incremental validation; server-side validation remains the enforcement of record even though the editor locks special entries client-side.
- No database schema change is introduced; `pos` remains a Cashier `role_permissions` row and `roles` is derived only for the Owner.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.1", "4.1", "6.1", "7.1", "8.1", "9.1", "11.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "4.3", "4.4", "6.2", "8.2", "9.2", "9.3", "10.1", "10.2", "10.3"] },
    { "id": 4, "tasks": ["12.1"] }
  ]
}
```
