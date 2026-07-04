"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import {
  createEmployee,
  deleteEmployee,
  updateEmployee,
} from "@/lib/services/employees";
import {
  employeeDeleteSchema,
  employeeSchema,
  employeeUpdateSchema,
} from "@/lib/validations/employees";
import type { ActionState, EmployeeSummary } from "@/types/domain";

function revalidateEmployeePaths() {
  revalidatePath("/admin/employees");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function createEmployeeAction(
  input: Parameters<typeof employeeSchema.parse>[0],
): Promise<ActionState<EmployeeSummary | null>> {
  await requirePermission("employees", "/admin/employees");

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the employee form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const employee = await createEmployee(parsed.data);
    revalidateEmployeePaths();

    return {
      ok: true,
      message: "Employee saved.",
      data: employee,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save employee.",
    };
  }
}

export async function updateEmployeeAction(
  input: Parameters<typeof employeeUpdateSchema.parse>[0],
): Promise<ActionState<EmployeeSummary | null>> {
  await requirePermission("employees", "/admin/employees");

  const parsed = employeeUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the employee form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const employee = await updateEmployee(parsed.data);
    revalidateEmployeePaths();

    return {
      ok: true,
      message: "Employee saved.",
      data: employee,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update employee.",
    };
  }
}

export async function deleteEmployeeAction(input: {
  id: string;
}): Promise<ActionState<{ id: string }>> {
  await requirePermission("employees", "/admin/employees");

  const parsed = employeeDeleteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid employee selection.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await deleteEmployee(parsed.data.id);
    revalidateEmployeePaths();

    return {
      ok: true,
      message: "Employee removed.",
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to delete employee.",
    };
  }
}
