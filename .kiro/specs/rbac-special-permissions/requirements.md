# Requirements Document

## Introduction

This feature refines the existing configurable Role-Based Access Control (RBAC) system of the POS/e-commerce application by introducing two "special" permissions whose behavior intentionally deviates from the standard, configurable permission keys.

Today the system resolves permissions per role, the Owner (the `admin` DB role, displayed as "Owner") automatically receives **every** permission key, and the configurable roles (Manager, Clerk, Cashier) hold whatever keys the Owner assigns in the per-role matrix at `/admin/roles`. Two permission keys must break out of this model:

1. **`pos`** — Point-of-Sale access must become Cashier-exclusive. The Owner, despite otherwise having full access, must be unable to enter POS mode. This is a deliberate exception to the "Owner has all permissions" rule.
2. **`roles`** — Access to the Roles & Access management page must become Owner-exclusive and must never be grantable to any other role, even through the editable matrix.

This document specifies only these two special-permission rules and their supporting behaviors (navigation visibility, redirects, matrix UI presentation, and redirect-loop safety). It introduces no other changes to the permission catalog or enforcement model. No code changes are produced as part of this requirements phase.

## Glossary

- **Owner**: A staff account holding the `admin` DB role (`public.user_role` value `admin`, displayed in the UI as "Owner").
- **Cashier**: A staff account holding the `cashier` DB role.
- **Manager**: A staff account holding the `manager` DB role.
- **Clerk**: A staff account holding the `clerk` DB role (Inventory Clerk).
- **Configurable_Role**: Any of Manager, Clerk, or Cashier — roles whose permission grants are editable in the matrix (`CONFIGURABLE_ROLES`).
- **Permission_System**: The permission-resolution logic that computes the set of permission keys an account holds from its roles (`getPermissionsForRoles`).
- **Permission_Key**: A catalog entry such as `pos`, `dashboard`, `products`, or `roles`, each mapped to one or more routes.
- **Special_Permission**: A Permission_Key (`pos` or `roles`) governed by the rules in this document instead of the standard configurable matrix behavior.
- **POS_Module**: The `/pos` route group (layout, pages) and POS server actions guarded by `requirePermission("pos")`.
- **Roles_Admin_Page**: The `/admin/roles` page and its server actions (`setRolePermissions`, `setUserRoles`) guarded by the `roles` permission.
- **Permission_Matrix_Editor**: The Owner-facing UI at `/admin/roles` that displays and edits per-role permission grants.
- **Navigation_Menu**: The sidebar/navigation in the dashboard shell that lists links the current account is allowed to open (`allowedNavHrefs`).
- **Staff_Home**: The safe landing route computed for an account by `resolveStaffHome`, falling back to `/shop` when no workspace is accessible.
- **Access_Control_System**: The combined server-side enforcement layer (layout guards, `requirePermission`, and matrix-save validation).

## Decisions and Assumptions (please confirm during review)

These resolve the open questions raised for this feature. They are stated as the basis for the acceptance criteria below; change any that do not match intent.

- **D1 — POS is strictly Cashier-only.** The `pos` permission cannot be granted to Manager or Clerk. POS remains a row in the matrix but is editable/applicable only for Cashier; it is shown locked (read-only) for Manager and Clerk.
- **D2 — Owner cannot use POS.** Owner status does not grant `pos`. The POS navigation link is hidden for an Owner who lacks the Cashier role, and navigating to any `/pos` route redirects such an Owner to `/admin`.
- **D3 — POS access is role-scoped, not person-scoped.** `pos` is granted to an account if and only if it holds the Cashier role. An account that explicitly holds **both** Owner and Cashier roles therefore retains POS access through its Cashier role. (Flagged for confirmation — if the Owner role must hard-block POS even when combined with Cashier, this rule changes.)
- **D4 — Roles & Access is Owner-only and not editable.** The `roles` permission is granted only to the Owner, can never be assigned to a Configurable_Role, and is presented as a locked, Owner-exclusive row in the matrix.
- **D5 — Owner redirect target from POS is `/admin`.** This is a route the Owner can always access, preserving redirect-loop safety.
- **D6 — Existing fallbacks are preserved.** All special-permission redirects resolve to a route the account can access, retaining the `resolveStaffHome` → `/shop` fallback so no redirect loops are introduced.

## Requirements

### Requirement 1: POS permission is Cashier-exclusive

**User Story:** As an Owner, I want the POS permission to belong only to the Cashier role, so that point-of-sale access is restricted to register staff rather than every back-office role.

#### Acceptance Criteria

1. WHERE an account holds the Cashier role, THE Permission_System SHALL include the `pos` permission key in that account's resolved permission set, including when the account holds additional roles alongside Cashier.
2. IF an account does not hold the Cashier role, THEN THE Permission_System SHALL exclude the `pos` permission key from that account's resolved permission set, including for the Owner role.
3. WHEN the Permission_Matrix_Editor submits a permission set containing the `pos` permission key for the Manager role or the Clerk role, THE Access_Control_System SHALL reject the submission without modifying the stored permission matrix for that role.
4. WHEN the Access_Control_System rejects a submission for containing the `pos` permission key on a non-Cashier role, THE Access_Control_System SHALL return an error message identifying the `pos` key as not grantable to that role.
5. WHEN the Permission_Matrix_Editor submits a permission set containing the `pos` permission key for the Cashier role, THE Access_Control_System SHALL accept the submission and persist the `pos` key as a valid grant for the Cashier role.

### Requirement 2: Owner is excluded from POS mode

**User Story:** As an Owner, I want to be unable to enter POS mode despite having full access elsewhere, so that the register workflow stays scoped to Cashier staff.

#### Acceptance Criteria

1. IF an account holds the Owner role and does not hold the Cashier role, THEN THE Permission_System SHALL exclude the `pos` permission key from that account's resolved permission set, overriding the rule that grants the Owner every permission key.
2. WHEN an account that lacks the `pos` permission requests the `/pos` route or any route nested within the `/pos` route group, THE POS_Module SHALL redirect that account to `/admin` without rendering any POS content.
3. WHEN the Navigation_Menu is rendered for an account that lacks the `pos` permission, THE Navigation_Menu SHALL omit the POS link.
4. WHEN a POS server action is invoked by an account that lacks the `pos` permission, THE POS_Module SHALL deny the action without producing any state-changing effect and SHALL redirect the caller to `/admin`.
5. WHEN the Access_Control_System redirects an Owner away from a `/pos` route, THE Access_Control_System SHALL perform exactly one redirect to `/admin` and SHALL NOT produce any further access redirect.

### Requirement 3: Roles & Access page is Owner-exclusive

**User Story:** As an Owner, I want the Roles & Access page and the `roles` permission reserved for the Owner alone, so that no other role can change the permission matrix or role assignments.

#### Acceptance Criteria

1. WHERE an account holds the Owner role, THE Permission_System SHALL include the `roles` permission key in that account's resolved permission set.
2. IF an account does not hold the Owner role, THEN THE Permission_System SHALL exclude the `roles` permission key from that account's resolved permission set.
3. WHEN an account that lacks the `roles` permission requests the `/admin/roles` route, THE Roles_Admin_Page SHALL deny rendering of the page and SHALL redirect that account to its Staff_Home, which the account is permitted to open.
4. WHEN the Permission_Matrix_Editor submits a permission set for any Configurable_Role (Manager, Clerk, or Cashier) that contains the `roles` permission key, THE Access_Control_System SHALL reject the submission, SHALL leave that role's existing permission grants unchanged, and SHALL return an error message indicating that the `roles` permission cannot be assigned to a Configurable_Role.
5. WHEN a Roles_Admin_Page server action (`setRolePermissions` or `setUserRoles`) is invoked by an account that lacks the `roles` permission, THE Access_Control_System SHALL deny the action, SHALL leave all role permission grants and user-role assignments unchanged, and SHALL redirect the caller to its Staff_Home.
6. THE Navigation_Menu SHALL omit the Roles & Access link for any account that lacks the `roles` permission.

### Requirement 4: Permission matrix presents special permissions as locked

**User Story:** As an Owner, I want the matrix to visually distinguish the special POS and Roles permissions, so that I understand why they cannot be edited like ordinary permissions.

#### Acceptance Criteria

1. WHILE the Cashier role is selected in the Permission_Matrix_Editor, THE Permission_Matrix_Editor SHALL render the `pos` permission as an interactive toggle control whose displayed state reflects the Cashier role's current `pos` grant and which the Owner can switch between granted and not-granted.
2. WHILE the Manager role or the Clerk role is selected in the Permission_Matrix_Editor, THE Permission_Matrix_Editor SHALL render the `pos` permission as a non-interactive, non-toggleable entry that displays a not-granted state and a visible label identifying it as Cashier-only.
3. WHILE any Configurable_Role is selected in the Permission_Matrix_Editor, THE Permission_Matrix_Editor SHALL render the `roles` permission as a non-interactive, non-toggleable entry that displays a not-granted state and a visible label identifying it as Owner-exclusive.
4. WHILE the Permission_Matrix_Editor is displayed, THE Permission_Matrix_Editor SHALL show, for each of the `pos` and `roles` permissions, a visible indicator identifying it as a Special_Permission distinct from standard configurable permissions.
5. WHILE the `pos` or `roles` permission is rendered as a locked, non-toggleable entry, THE Permission_Matrix_Editor SHALL display visible explanatory text stating the reason the permission cannot be edited.
6. IF the Owner attempts to change the state of a locked, non-toggleable special-permission entry, THEN THE Permission_Matrix_Editor SHALL prevent the state change and SHALL retain the displayed grant state unchanged.

### Requirement 5: Redirect-loop safety is preserved

**User Story:** As a staff member, I want every access redirect to land on a page I can open, so that the new special-permission rules never trap me in a redirect loop.

#### Acceptance Criteria

1. WHEN the Access_Control_System redirects an account away from a route it cannot access, THE Access_Control_System SHALL select a redirect target whose required Permission_Key is present in the account's resolved permission set, or a public route that requires no Permission_Key.
2. WHEN the Access_Control_System selects a redirect target for an account, THE Access_Control_System SHALL select a target that, when requested by that same account, resolves without producing a further access redirect, so that any redirect chain terminates in at most one redirect.
3. IF an account has no accessible back-office or POS workspace after the special-permission rules are applied, THEN THE Access_Control_System SHALL redirect that account to `/shop`, which requires no Permission_Key and produces no further redirect.
4. WHEN an Owner is redirected away from a `/pos` route, THE Access_Control_System SHALL redirect that Owner to `/admin`, for which the Owner always holds the required Permission_Key.
