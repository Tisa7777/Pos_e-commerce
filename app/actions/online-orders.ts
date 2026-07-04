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
  try {
    await requirePermission("pos", "/pos");

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
  } catch {
    return { count: 0, latestOrderNumber: null };
  }
}
