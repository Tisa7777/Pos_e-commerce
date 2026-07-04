"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import {
  createCategory,
  createSupplier,
  deleteCategory,
  deleteSupplier,
  updateCategory,
  updateSupplier,
} from "@/lib/services/products";
import {
  categorySchema,
  categoryUpdateSchema,
  supplierSchema,
  supplierUpdateSchema,
} from "@/lib/validations/catalog";
import type { ActionState, CategorySummary, SupplierSummary } from "@/types/domain";

interface DeleteResult {
  id: string;
  unlinkedCount: number;
}

function revalidateCatalogPaths() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/shop");
}

export async function createCategoryAction(
  input: {
    name: string;
    description?: string;
    visualIcon?: string;
    accentColor?: string;
  },
): Promise<ActionState<CategorySummary>> {
  await requirePermission("categories", "/admin/categories");

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the category form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const category = await createCategory(parsed.data);
    revalidateCatalogPaths();

    return {
      ok: true,
      message: "Category saved.",
      data: category,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save the category.",
    };
  }
}

export async function updateCategoryAction(
  input: {
    id: string;
    name: string;
    description?: string;
    visualIcon?: string;
    accentColor?: string;
  },
): Promise<ActionState<CategorySummary>> {
  await requirePermission("categories", "/admin/categories");

  const parsed = categoryUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the category form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const category = await updateCategory(parsed.data);
    revalidateCatalogPaths();

    return {
      ok: true,
      message: "Category saved.",
      data: category,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update the category.",
    };
  }
}

export async function deleteCategoryAction(
  input: { id: string },
): Promise<ActionState<DeleteResult>> {
  await requirePermission("categories", "/admin/categories");

  const parsed = categoryUpdateSchema.pick({ id: true }).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid category selection.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await deleteCategory(parsed.data.id);
    revalidateCatalogPaths();

    return {
      ok: true,
      message: "Category removed.",
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to delete the category.",
    };
  }
}

export async function createSupplierAction(
  input: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    notes?: string;
    productIds: string[];
  },
): Promise<ActionState<SupplierSummary | null>> {
  await requirePermission("suppliers", "/admin/suppliers");

  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the supplier form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supplier = await createSupplier(parsed.data);
    revalidateCatalogPaths();

    return {
      ok: true,
      message: "Supplier added.",
      data: supplier,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save the supplier.",
    };
  }
}

export async function updateSupplierAction(
  input: {
    id: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    notes?: string;
    productIds: string[];
  },
): Promise<ActionState<SupplierSummary | null>> {
  await requirePermission("suppliers", "/admin/suppliers");

  const parsed = supplierUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the supplier form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supplier = await updateSupplier(parsed.data);
    revalidateCatalogPaths();

    return {
      ok: true,
      message: "Supplier saved.",
      data: supplier,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update the supplier.",
    };
  }
}

export async function deleteSupplierAction(
  input: { id: string },
): Promise<ActionState<DeleteResult>> {
  await requirePermission("suppliers", "/admin/suppliers");

  const parsed = supplierUpdateSchema.pick({ id: true }).safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid supplier selection.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await deleteSupplier(parsed.data.id);
    revalidateCatalogPaths();

    return {
      ok: true,
      message: "Supplier removed.",
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to delete the supplier.",
    };
  }
}
