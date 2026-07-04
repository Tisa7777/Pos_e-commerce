"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { buildInventoryReasonText } from "@/lib/inventory/options";
import { adjustInventory } from "@/lib/services/inventory";
import { getProductById } from "@/lib/services/products";
import { inventoryAdjustmentSchema } from "@/lib/validations/inventory";
import type { ActionState, InventoryAdjustmentResult } from "@/types/domain";

export async function adjustInventoryAction(
  _previousState: ActionState<InventoryAdjustmentResult>,
  formData: FormData,
): Promise<ActionState<InventoryAdjustmentResult>> {
  const profile = await requirePermission("inventory", "/admin/inventory");
  const parsed = inventoryAdjustmentSchema.safeParse({
    mode: formData.get("mode"),
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please review the stock adjustment form before saving.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const quantityDelta =
    parsed.data.mode === "add" ? parsed.data.quantity : -parsed.data.quantity;
  const reason = buildInventoryReasonText(parsed.data.reason, parsed.data.notes);

  try {
    await adjustInventory(profile, {
      productId: parsed.data.productId,
      quantityDelta,
      reason,
    });

    const product = await getProductById(parsed.data.productId);

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
    revalidatePath("/admin");

    if (!product) {
      return {
        ok: true,
        message: "Stock updated successfully.",
      };
    }

    return {
      ok: true,
      message: `Stock updated — ${product.name} is now ${product.stockQuantity} units.`,
      data: {
        productId: product.id,
        productName: product.name,
        quantityDelta,
        newStockQuantity: product.stockQuantity,
        movementType: quantityDelta > 0 ? "restock" : "adjustment",
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update stock right now.",
    };
  }
}
