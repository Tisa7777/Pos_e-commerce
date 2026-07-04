export const FREE_DELIVERY_MINIMUM = 5;
export const DELIVERY_FEE = 1.5;

export type FulfillmentType = "pickup" | "delivery";

export function calculateDeliveryFee(
  fulfillmentType: FulfillmentType,
  subtotal: number,
) {
  if (fulfillmentType !== "delivery") {
    return 0;
  }

  return subtotal >= FREE_DELIVERY_MINIMUM ? 0 : DELIVERY_FEE;
}

export function getAmountUntilFreeDelivery(subtotal: number) {
  return Math.max(FREE_DELIVERY_MINIMUM - subtotal, 0);
}
