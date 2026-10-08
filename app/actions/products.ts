"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import {
  createProduct,
  deleteProduct,
  setProductActive,
  updateProduct,
  uploadProductImage,
} from "@/lib/services/products";
import {
  productDeleteSchema,
  productSchema,
  productStatusSchema,
  productUpdateSchema,
} from "@/lib/validations/product";
import type { ActionState } from "@/types/domain";

function revalidateProductPaths(productSlug?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/shop");
  revalidatePath("/pos");
  revalidatePath("/pos/cart");
  revalidatePath("/pos/checkout");

  if (productSlug) {
    revalidatePath(`/shop/${productSlug}`);
  }
}

function getProductFormData(formData: FormData) {
  return {
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
    sku: formData.get("sku"),
    barcode: formData.get("barcode"),
    categoryId: formData.get("categoryId"),
    supplierId: formData.get("supplierId"),
    price: formData.get("price"),
    cost: formData.get("cost"),
    stockQuantity: formData.get("stockQuantity"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    isActive: formData.get("isActive"),
  };
}

export async function createProductAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("products", "/admin/products");

  const parsed = productSchema.safeParse(getProductFormData(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the product form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const product = await createProduct({
      ...parsed.data,
      categoryId: parsed.data.categoryId || undefined,
      supplierId: parsed.data.supplierId || undefined,
      barcode: parsed.data.barcode || undefined,
      description: parsed.data.description || undefined,
    });

    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      await uploadProductImage(product.id, image);
    }

    revalidateProductPaths(product.slug);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to save the product.",
    };
  }

  redirect("/admin/products");
}

export async function updateProductAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("products", "/admin/products");

  const parsed = productUpdateSchema.safeParse(getProductFormData(formData));

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the product form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const product = await updateProduct({
      ...parsed.data,
      categoryId: parsed.data.categoryId || undefined,
      supplierId: parsed.data.supplierId || undefined,
      barcode: parsed.data.barcode || undefined,
      description: parsed.data.description || undefined,
    });

    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      await uploadProductImage(product.id, image);
    }

    revalidateProductPaths(product.slug);
    revalidatePath(`/admin/products/${product.id}/edit`);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update the product.",
    };
  }

  redirect("/admin/products");
}

export async function updateProductStatusAction(input: {
  id: string;
  isActive: boolean;
}): Promise<ActionState<{ id: string }>> {
  await requirePermission("products", "/admin/products");

  const parsed = productStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid product selection.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const product = await setProductActive(parsed.data.id, parsed.data.isActive);
    revalidateProductPaths();

    return {
      ok: true,
      message: parsed.data.isActive ? "Product activated." : "Product deactivated.",
      data: product,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update the product status.",
    };
  }
}

export async function updateProductStatusFormAction(formData: FormData) {
  await requirePermission("products", "/admin/products");

  const parsed = productStatusSchema.safeParse({
    id: formData.get("id"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    redirect("/admin/products");
  }

  await setProductActive(parsed.data.id, parsed.data.isActive);
  revalidateProductPaths();
  redirect("/admin/products");
}

export async function deleteProductFormAction(formData: FormData) {
  await requirePermission("products", "/admin/products");

  const parsed = productDeleteSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    redirect("/admin/products");
  }

  const product = await deleteProduct(parsed.data.id);
  revalidateProductPaths(product.slug);
  redirect("/admin/products");
}
