"use server";

import { requirePermission } from "@/lib/auth/guards";
import { listOrders } from "@/lib/services/orders";

/**
 * Server action that returns the count of pending online orders.
 * Used by the POS polling hook to detect new orders.
 */
export async function getOnlineOrderCountAction(): Promise<{
  count: number;
  latestOrderNumber: string | null;
}> {
  // Kept outside the try/catch below: redirect() signals by throwing, so
  // catching it here would silently swallow the auth redirect.
  await requirePermission("pos", "/pos");

  try {
    const orders = await listOrders({
      roles: ["cashier"],
      channel: "ecommerce",
      limit: 50,
    });

    const pendingOrders = orders.filter(
      (order) => order.status === "pending" || order.status === "paid",
    );

    return {
      count: pendingOrders.length,
      latestOrderNumber: pendingOrders[0]?.orderNumber ?? null,
    };
  } catch (error) {
    // A real failure must not look like an empty queue, or cashiers stop
    // getting notified about incoming online orders.
    console.error("[getOnlineOrderCountAction] error:", error);
    throw error instanceof Error
      ? error
      : new Error("Unable to load pending online orders.");
  }
}
