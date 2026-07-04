// Client-safe loyalty constants (no server-only imports).

/** Loyalty redemption tiers: points spent -> percentage discount coupon. */
export const LOYALTY_REWARD_TIERS = [
  { points: 50, discountPercent: 10 },
  { points: 100, discountPercent: 30 },
] as const;

export type LoyaltyRewardTier = (typeof LOYALTY_REWARD_TIERS)[number];

/** How long a redeemed coupon stays valid. */
export const COUPON_VALID_DAYS = 30;

/** Loyalty points earned per 1.00 spent on an order. */
export const POINTS_EARNED_PER_CURRENCY = 2;
