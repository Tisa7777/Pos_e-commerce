"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyPermission, requirePermission } from "@/lib/auth/guards";
import {
  addCustomerLoyaltyPoints,
  createCustomer,
  deleteCustomer,
  saveCustomerDiscount,
  updateCustomer,
} from "@/lib/services/customers";
import {
  customerDiscountSchema,
  customerPointsSchema,
  customerSchema,
  customerUpdateSchema,
} from "@/lib/validations/customers";
import type { ActionState, CustomerSummary } from "@/types/domain";

interface CustomerDeleteResult {
  id: string;
  orderCount: number;
}

function revalidateCustomerPaths() {
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
  revalidatePath("/pos");
  revalidatePath("/pos/cart");
  revalidatePath("/pos/checkout");
}

export async function createCustomerAction(input: {
  fullName: string;
  email?: string;
  phone?: string;
  loyaltyPoints?: number;
  notes?: string;
  discountPercent?: number;
  discountExpiresAt?: string | null;
}): Promise<ActionState<CustomerSummary | null>> {
  // Reachable from Admin > Customers and from the POS register, so accept
  // either permission. A hardcoded ["admin","cashier"] list locked out managers
  // and any custom role that had been granted the `customers` permission.
  await requireAnyPermission(["customers", "pos"], "/admin");

  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the customer form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const customer = await createCustomer(parsed.data);
    revalidateCustomerPaths();

    return {
      ok: true,
      message: "Customer saved.",
      data: customer,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save the customer.",
    };
  }
}

export async function updateCustomerAction(input: {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  loyaltyPoints?: number;
  notes?: string;
  discountPercent?: number;
  discountExpiresAt?: string | null;
}): Promise<ActionState<CustomerSummary | null>> {
  await requirePermission("customers", "/admin/customers");

  const parsed = customerUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the customer form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const customer = await updateCustomer(parsed.data);
    revalidateCustomerPaths();

    return {
      ok: true,
      message: "Customer saved.",
      data: customer,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update the customer.",
    };
  }
}

export async function saveCustomerDiscountAction(input: {
  id: string;
  notes?: string;
  discountPercent: number;
  discountExpiresAt?: string | null;
}): Promise<ActionState<CustomerSummary | null>> {
  await requirePermission("customers", "/admin/customers");

  const parsed = customerDiscountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the discount settings before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const customer = await saveCustomerDiscount(parsed.data);
    revalidateCustomerPaths();

    return {
      ok: true,
      message: "Customer discount saved.",
      data: customer,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save the customer discount.",
    };
  }
}

export async function addCustomerPointsAction(input: {
  id: string;
  pointsToAdd: number;
}): Promise<ActionState<CustomerSummary | null>> {
  await requirePermission("customers", "/admin/customers");

  const parsed = customerPointsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a valid points amount.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const customer = await addCustomerLoyaltyPoints(parsed.data);
    revalidateCustomerPaths();

    return {
      ok: true,
      message: "Customer loyalty updated.",
      data: customer,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update loyalty points.",
    };
  }
}

export async function deleteCustomerAction(input: {
  id: string;
}): Promise<ActionState<CustomerDeleteResult>> {
  await requirePermission("customers", "/admin/customers");

  const parsed = customerUpdateSchema.pick({ id: true }).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid customer selection.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await deleteCustomer(parsed.data.id);
    revalidateCustomerPaths();

    return {
      ok: true,
      message: "Customer removed.",
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to delete the customer.",
    };
  }
}

export async function deleteCustomerFormAction(formData: FormData) {
  await requirePermission("customers", "/admin/customers");

  const parsed = customerUpdateSchema.pick({ id: true }).safeParse({
    id: formData.get("id"),
  });

  if (parsed.success) {
    await deleteCustomer(parsed.data.id);
    revalidateCustomerPaths();
  }

  redirect("/admin/customers");
}
