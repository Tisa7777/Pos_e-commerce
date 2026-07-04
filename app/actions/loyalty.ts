"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { LOYALTY_REWARD_TIERS, redeemLoyaltyForCoupon } from "@/lib/services/loyalty";
import type { ActionState } from "@/types/domain";

export async function redeemLoyaltyCouponAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireUser("/account");

  const points = Number(formData.get("points"));
  const tier = LOYALTY_REWARD_TIERS.find((entry) => entry.points === points);

  if (!tier) {
    return { ok: false, message: "Choose a valid reward to redeem." };
  }

  try {
    const result = await redeemLoyaltyForCoupon({ profileId: profile.id, points: tier.points });

    revalidatePath("/account");
    revalidatePath("/", "layout");
    revalidatePath("/admin/customers");

    return {
      ok: true,
      message: `Success! Coupon ${result.coupon.code} for ${result.coupon.discountPercent}% off is ready. You have ${result.remainingPoints} points left.`,
      fieldErrors: {},
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to redeem your points.",
    };
  }
}
