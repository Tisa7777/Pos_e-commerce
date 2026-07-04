"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import {
  createRole,
  removeRole,
  setRolePermissions,
  setUserRoles,
} from "@/lib/services/access";
import type { ActionState, RoleDefinition, UserRole } from "@/types/domain";

export async function saveRolePermissionsAction(input: {
  role: UserRole;
  permissions: string[];
}): Promise<ActionState> {
  // Roles & Access is Owner-exclusive (the `roles` permission).
  await requirePermission("roles", "/admin");

  try {
    await setRolePermissions(input.role, input.permissions ?? []);
    revalidatePath("/admin/roles");
    revalidatePath("/", "layout");
    return { ok: true, message: "Permissions updated." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update permissions.",
    };
  }
}

export async function createRoleAction(input: {
  label: string;
  description?: string;
}): Promise<ActionState<RoleDefinition>> {
  await requirePermission("roles", "/admin");

  try {
    const role = await createRole(input);
    revalidatePath("/admin/roles");
    revalidatePath("/", "layout");
    return { ok: true, message: "Role created.", data: role };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to create role.",
    };
  }
}

export async function removeRoleAction(input: { role: UserRole }): Promise<ActionState> {
  await requirePermission("roles", "/admin");

  try {
    await removeRole(input.role);
    revalidatePath("/admin/roles");
    revalidatePath("/", "layout");
    return { ok: true, message: "Role removed." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to remove role.",
    };
  }
}

export async function setUserRolesAction(input: {
  profileId: string;
  roles: UserRole[];
}): Promise<ActionState> {
  await requirePermission("roles", "/admin");

  try {
    await setUserRoles(input.profileId, input.roles ?? []);
    revalidatePath("/admin/roles");
    revalidatePath("/", "layout");
    return { ok: true, message: "Roles updated." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update roles.",
    };
  }
}
