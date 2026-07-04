import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { isPostgresConfigured, requireBackendConfigured } from "@/lib/env";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import {
  COUPON_VALID_DAYS,
  LOYALTY_REWARD_TIERS,
  POINTS_EARNED_PER_CURRENCY,
} from "@/lib/loyalty/tiers";

export { COUPON_VALID_DAYS, LOYALTY_REWARD_TIERS, POINTS_EARNED_PER_CURRENCY };
export type { LoyaltyRewardTier } from "@/lib/loyalty/tiers";

export interface LoyaltyCoupon {
  id: string;
  code: string;
  discountPercent: number;
  pointsSpent: number;
  status: "active" | "redeemed" | "expired";
  expiresAt: string | null;
  createdAt: string;
  redeemedAt: string | null;
}

interface RawCouponRow {
  id: string;
  code: string;
  discount_percent: number;
  points_spent: number;
  status: string;
  expires_at: string | null;
  created_at: string;
  redeemed_at: string | null;
}

function mapCoupon(row: RawCouponRow): LoyaltyCoupon {
  const isExpired =
    row.status === "active" && row.expires_at !== null && new Date(row.expires_at).getTime() < Date.now();

  return {
    id: row.id,
    code: row.code,
    discountPercent: row.discount_percent,
    pointsSpent: row.points_spent,
    status: isExpired ? "expired" : (row.status as LoyaltyCoupon["status"]),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    redeemedAt: row.redeemed_at,
  };
}

function generateCouponCode() {
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `TISA-${random}`;
}

/** Lists a customer's loyalty coupons, newest first. */
export async function listCustomerCoupons(customerId: string): Promise<LoyaltyCoupon[]> {
  if (!isPostgresConfigured()) {
    return [];
  }

  const { rows } = await dbQuery<RawCouponRow>(
    `
      select id, code, discount_percent, points_spent, status, expires_at, created_at, redeemed_at
      from public.loyalty_coupons
      where customer_id = $1
      order by created_at desc
    `,
    [customerId],
  );

  return rows.map(mapCoupon);
}

export interface RedeemResult {
  ok: true;
  coupon: LoyaltyCoupon;
  remainingPoints: number;
}

/**
 * Converts loyalty points into a discount coupon for the signed-in customer.
 * Deducts the points, logs a loyalty transaction, and creates the coupon.
 */
export async function redeemLoyaltyForCoupon(input: {
  profileId: string;
  points: number;
}): Promise<RedeemResult> {
  if (!isPostgresConfigured()) {
    requireBackendConfigured("Loyalty redemption");
  }

  const tier = LOYALTY_REWARD_TIERS.find((entry) => entry.points === input.points);
  if (!tier) {
    throw new Error("Choose a valid reward to redeem.");
  }

  return withDbTransaction(async (client) => {
    const { rows: customerRows } = await client.query<{
      id: string;
      loyalty_points: number;
    }>(
      `
        select id, loyalty_points
        from public.customers
        where profile_id = $1 and is_active = true
        limit 1
        for update
      `,
      [input.profileId],
    );

    const customer = customerRows[0];
    if (!customer) {
      throw new Error("No customer account is linked to your profile yet.");
    }

    if (customer.loyalty_points < tier.points) {
      throw new Error(
        `You need ${tier.points} points for this reward. You have ${customer.loyalty_points}.`,
      );
    }

    const remainingPoints = customer.loyalty_points - tier.points;

    await client.query(
      `
        update public.customers
        set loyalty_points = $1
        where id = $2
      `,
      [remainingPoints, customer.id],
    );

    await client.query(
      `
        insert into public.loyalty_transactions (
          customer_id,
          created_by_profile_id,
          transaction_type,
          points_delta,
          balance_after,
          description
        )
        values ($1, $2, 'redeemed', $3, $4, $5)
      `,
      [
        customer.id,
        input.profileId,
        -tier.points,
        remainingPoints,
        `Redeemed ${tier.points} points for a ${tier.discountPercent}% coupon`,
      ],
    );

    let coupon: RawCouponRow | undefined;
    // Retry on the rare code collision.
    for (let attempt = 0; attempt < 5 && !coupon; attempt += 1) {
      try {
        const { rows } = await client.query<RawCouponRow>(
          `
            insert into public.loyalty_coupons (
              code,
              customer_id,
              profile_id,
              discount_percent,
              points_spent,
              status,
              expires_at
            )
            values ($1, $2, $3, $4, $5, 'active', timezone('utc', now()) + ($6 || ' days')::interval)
            returning id, code, discount_percent, points_spent, status, expires_at, created_at, redeemed_at
          `,
          [
            generateCouponCode(),
            customer.id,
            input.profileId,
            tier.discountPercent,
            tier.points,
            String(COUPON_VALID_DAYS),
          ],
        );
        coupon = rows[0];
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.includes("loyalty_coupons_code_key")) {
          throw error;
        }
      }
    }

    if (!coupon) {
      throw new Error("Unable to generate a coupon code. Please try again.");
    }

    return {
      ok: true,
      coupon: mapCoupon(coupon),
      remainingPoints,
    };
  });
}

/**
 * Validates a loyalty coupon during checkout and locks the row. Returns the
 * computed discount but does not mark it used yet (call markCouponRedeemed
 * after the order row exists).
 */
export async function validateCouponForCheckout(
  client: PoolClient,
  input: {
    code: string;
    customerId: string;
    subtotal: number;
  },
): Promise<{ couponId: string; discountAmount: number; discountPercent: number; code: string }> {
  const { rows } = await client.query<RawCouponRow>(
    `
      select id, code, discount_percent, points_spent, status, expires_at, created_at, redeemed_at
      from public.loyalty_coupons
      where customer_id = $1 and upper(code) = upper($2)
      limit 1
      for update
    `,
    [input.customerId, input.code.trim()],
  );

  const coupon = rows[0];
  if (!coupon) {
    throw new LoyaltyCouponError("That coupon code is not valid for your account.");
  }

  if (coupon.status !== "active") {
    throw new LoyaltyCouponError("That coupon has already been used.");
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    throw new LoyaltyCouponError("That coupon has expired.");
  }

  const discountAmount = Math.round(input.subtotal * (coupon.discount_percent / 100) * 100) / 100;

  return {
    couponId: coupon.id,
    discountAmount,
    discountPercent: coupon.discount_percent,
    code: coupon.code,
  };
}

/** Marks a previously validated coupon as redeemed against an order. */
export async function markCouponRedeemed(
  client: PoolClient,
  input: { couponId: string; orderId: string },
) {
  await client.query(
    `
      update public.loyalty_coupons
      set status = 'redeemed',
          redeemed_order_id = $1,
          redeemed_at = timezone('utc', now())
      where id = $2
    `,
    [input.orderId, input.couponId],
  );
}

/** Awards loyalty points for a completed order (inside the order transaction). */
export async function awardLoyaltyPointsForOrder(
  client: PoolClient,
  input: {
    customerId: string;
    orderId: string;
    amountSpent: number;
  },
) {
  const points = Math.floor(input.amountSpent * POINTS_EARNED_PER_CURRENCY);
  if (points <= 0) {
    return 0;
  }

  const { rows } = await client.query<{ loyalty_points: number }>(
    `
      update public.customers
      set loyalty_points = loyalty_points + $1
      where id = $2
      returning loyalty_points
    `,
    [points, input.customerId],
  );

  await client.query(
    `
      insert into public.loyalty_transactions (
        customer_id,
        order_id,
        transaction_type,
        points_delta,
        balance_after,
        description
      )
      values ($1, $2, 'earned', $3, $4, $5)
    `,
    [
      input.customerId,
      input.orderId,
      points,
      rows[0]?.loyalty_points ?? null,
      `Earned ${points} points from order`,
    ],
  );

  return points;
}

export class LoyaltyCouponError extends Error {}
