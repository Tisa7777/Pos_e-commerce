"use server";

import { getCurrentProfile } from "@/lib/auth/guards";
import { listOrders } from "@/lib/services/orders";
import type { OrderDetail } from "@/types/domain";

/**
 * Returns the signed-in customer's own ecommerce orders (most recent first).
 * Guests get an empty list and should track orders by number instead.
 */
export async function listMyOrdersAction(): Promise<OrderDetail[]> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return [];
  }

  try {
    return await listOrders({
      profileId: profile.id,
      roles: profile.roles,
      channel: "ecommerce",
      limit: 50,
    });
  } catch {
    return [];
  }
}
