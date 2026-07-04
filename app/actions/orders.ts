"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { dbQuery } from "@/lib/db/postgres";
import { isPostgresConfigured, isSupabaseConfigured } from "@/lib/env";
import { serializePosReceiptMetadata } from "@/lib/pos/receipt-metadata";
import { completePosSale, getOrderById } from "@/lib/services/orders";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { parsePosItems, posCheckoutSchema } from "@/lib/validations/order";
import type { ActionState, OrderStatus, PosSaleSnapshot } from "@/types/domain";

export async function completePosSaleAction(
  _previousState: ActionState<PosSaleSnapshot>,
  formData: FormData,
): Promise<ActionState<PosSaleSnapshot>> {
  const profile = await requirePermission("pos", "/pos");

  const parsed = posCheckoutSchema.safeParse({
    customerId: formData.get("customerId"),
    discountAmount: formData.get("discountAmount"),
    paymentMethod: formData.get("paymentMethod"),
    notes: formData.get("notes"),
    cashierName: formData.get("cashierName"),
    cashierProfileId: formData.get("cashierProfileId"),
    posShiftId: formData.get("posShiftId"),
    displaySubtotal: formData.get("displaySubtotal"),
    displayTax: formData.get("displayTax"),
    displayTotal: formData.get("displayTotal"),
    taxRate: formData.get("taxRate"),
    cashReceived: formData.get("cashReceived"),
    changeGiven: formData.get("changeGiven"),
    itemsJson: formData.get("itemsJson"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please complete the POS cart before checking out.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const parsedItems = parsePosItems(parsed.data.itemsJson);
    const items = parsedItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      productName: item.productName,
      sku: item.sku,
      unitPrice: item.unitPrice,
    }));
    const subtotal = parsed.data.displaySubtotal ?? parsedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const fallbackTotal = parsed.data.displayTotal ?? Math.max(
      subtotal + (parsed.data.displayTax ?? 0) - parsed.data.discountAmount,
      0,
    );
    const serializedNotes = serializePosReceiptMetadata({
      noteText: parsed.data.notes || null,
      cashierName: parsed.data.cashierName || profile.fullName,
      cashReceived:
        parsed.data.paymentMethod === "cash" ? parsed.data.cashReceived ?? fallbackTotal : null,
      changeGiven:
        parsed.data.paymentMethod === "cash" ? parsed.data.changeGiven ?? 0 : null,
      displaySubtotal: subtotal,
      displayTax: parsed.data.displayTax ?? 0,
      displayDiscount: parsed.data.discountAmount,
      displayTotal: fallbackTotal,
      taxRate: parsed.data.taxRate ?? null,
      itemSequence: parsedItems.map((item) => item.productId),
    });

    const customerName = (formData.get("customerName") as string) || "Walk-in Customer";

    const orderId = await completePosSale(profile, {
      customerId: parsed.data.customerId || undefined,
      customerName,
      discountAmount: parsed.data.discountAmount,
      paymentMethod: parsed.data.paymentMethod,
      notes: serializedNotes || undefined,
      items,
      cashierName: parsed.data.cashierName || profile.fullName,
      cashierProfileId: parsed.data.cashierProfileId || undefined,
      posShiftId: parsed.data.posShiftId || undefined,
      displaySubtotal: subtotal,
      displayTax: parsed.data.displayTax ?? 0,
      displayTotal: fallbackTotal,
      cashReceived: parsed.data.paymentMethod === "cash" ? parsed.data.cashReceived ?? fallbackTotal : null,
      changeGiven: parsed.data.paymentMethod === "cash" ? parsed.data.changeGiven ?? 0 : null,
    });

    const order = await getOrderById(orderId, profile);

    revalidatePath("/pos");
    revalidatePath("/pos/cart");
    revalidatePath("/pos/checkout");
    revalidatePath("/pos/history");
    revalidatePath(`/pos/history/${orderId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/inventory");

    return {
      ok: true,
      message: "Sale completed successfully.",
      data: {
        orderId,
        orderNumber: order?.orderNumber ?? orderId,
        totalAmount: parsed.data.displayTotal ?? order?.totalAmount ?? fallbackTotal,
        createdAt: order?.createdAt ?? new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to complete the sale.",
    };
  }
}

export async function updateOnlineOrderStatusAction(formData: FormData) {
  await requirePermission("pos", "/pos/online-orders");

  const orderId = String(formData.get("orderId") ?? "");
  const nextStatus = String(formData.get("status") ?? "") as OrderStatus;
  const allowedStatuses: OrderStatus[] = ["pending", "processing", "completed", "cancelled"];

  if (!orderId || !allowedStatuses.includes(nextStatus)) {
    throw new Error("Invalid online order status update.");
  }

  const paymentStatus = nextStatus === "completed" ? "paid" : undefined;

  if (isPostgresConfigured()) {
    await dbQuery(
      `
        update public.orders
        set
          status = $1,
          payment_status = coalesce($2::public.payment_status, payment_status),
          updated_at = timezone('utc', now())
        where id = $3
          and channel = 'ecommerce'
      `,
      [nextStatus, paymentStatus ?? null, orderId],
    );
  } else if (isSupabaseConfigured()) {
    const supabase = createSupabaseServiceRoleClient();
    const updatePayload: { status: OrderStatus; payment_status?: "paid" } = {
      status: nextStatus,
    };

    if (paymentStatus) {
      updatePayload.payment_status = paymentStatus;
    }

    const { error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .eq("channel", "ecommerce");

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/pos");
  revalidatePath("/pos/online-orders");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
}
