import { PageHeader } from "@/components/ui/page-header";
import { RolePermissionsEditor } from "@/components/dashboard/role-permissions-editor";
import { UserRolesEditor } from "@/components/dashboard/user-roles-editor";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import {
  getConfigurableRolePermissions,
  listRoleDefinitions,
  listStaffAccounts,
} from "@/lib/services/access";

export default async function RolesPage() {
  // Owner-exclusive page (the `roles` permission).
  await requirePermission("roles", "/admin");

  const [roleDefinitions, initialPermissions, staffAccounts] = await Promise.all([
    listRoleDefinitions(),
    getConfigurableRolePermissions(),
    listStaffAccounts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        description="Configure role-based access control (RBAC): set which back-office areas each role can open, and assign roles to staff accounts."
      />

      <RolePermissionsEditor
        catalog={PERMISSION_CATALOG.map((p) => ({ key: p.key, label: p.label }))}
        roleDefinitions={roleDefinitions}
        initial={initialPermissions}
      />

      <UserRolesEditor
        accounts={staffAccounts}
        roleOptions={roleDefinitions
          .filter((role) => role.kind !== "none")
          .map((role) => ({ role: role.role, label: role.label }))}
      />
    </div>
  );
}
