/**
 * Guest cart helpers — pure client-side localStorage operations.
 * Every mutation returns the updated cart array for convenience.
 */

import {
  DEFAULT_DRINK_SIZE,
  DEFAULT_ICE,
  DEFAULT_SWEET,
  getDrinkSizePrice,
  isDrinkProduct,
  type DrinkIce,
  type DrinkSize,
  type DrinkSweet,
} from "@/lib/catalog/drink-sizes";

const STORAGE_KEY = "tisa_guest_cart";

export interface GuestCartItem {
  product_id: string;
  name: string;
  price: number;
  size?: DrinkSize | null;
  ice?: DrinkIce | null;
  sweet?: DrinkSweet | null;
  image_url: string | null;
  category: string;
  quantity: number;
}

export function getGuestCartLineId(
  productId: string,
  size?: DrinkSize | null,
  ice?: DrinkIce | null,
  sweet?: DrinkSweet | null,
) {
  return [productId, size ?? "", ice ?? "", sweet ?? ""].join("|");
}

export function getGuestCartItemLineId(
  item: Pick<GuestCartItem, "product_id" | "size" | "ice" | "sweet">,
) {
  return getGuestCartLineId(item.product_id, item.size, item.ice, item.sweet);
}

function normalizeGuestCartItem(item: GuestCartItem): GuestCartItem {
  const isDrink = isDrinkProduct({ category: { name: item.category } });
  const size = item.size ?? (isDrink ? DEFAULT_DRINK_SIZE : null);
  const ice = item.ice ?? (isDrink ? DEFAULT_ICE : null);
  const sweet = item.sweet ?? (isDrink ? DEFAULT_SWEET : null);

  return {
    ...item,
    price: Number(item.price),
    size,
    ice,
    sweet,
    quantity: Number(item.quantity),
  };
}

/** Read the current guest cart from localStorage. */
export function getGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as GuestCartItem[]) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeGuestCartItem) : [];
  } catch {
    return [];
  }
}

/** Persist the cart array to localStorage. */
export function saveGuestCart(items: GuestCartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Add a product (or increment qty if already in cart). Returns updated cart. */
export function addToGuestCart(product: {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  category?: { name?: string } | null;
}, options: {
  size?: DrinkSize | null;
  ice?: DrinkIce | null;
  sweet?: DrinkSweet | null;
  quantity?: number;
} = {}): GuestCartItem[] {
  const cart = getGuestCart();
  const size = options.size ?? null;
  const ice = options.ice ?? null;
  const sweet = options.sweet ?? null;
  const quantity = Math.max(1, Math.floor(options.quantity ?? 1));
  const lineId = getGuestCartLineId(product.id, size, ice, sweet);
  const existing = cart.find((item) => getGuestCartItemLineId(item) === lineId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: getDrinkSizePrice(product.price, size),
      size,
      ice,
      sweet,
      image_url: product.imageUrl ?? null,
      category: product.category?.name ?? "General",
      quantity,
    });
  }

  saveGuestCart(cart);
  return cart;
}

/** Remove a product entirely from the guest cart. Returns updated cart. */
export function removeFromGuestCart(lineId: string): GuestCartItem[] {
  const cart = getGuestCart().filter((item) => getGuestCartItemLineId(item) !== lineId);
  saveGuestCart(cart);
  return cart;
}

/** Set a specific quantity for a product. Removes if qty <= 0. Returns updated cart. */
export function updateGuestCartQty(lineId: string, qty: number): GuestCartItem[] {
  if (qty <= 0) return removeFromGuestCart(lineId);

  const cart = getGuestCart();
  const item = cart.find((i) => getGuestCartItemLineId(i) === lineId);
  if (item) {
    item.quantity = qty;
  }

  saveGuestCart(cart);
  return cart;
}

/** Clear the entire guest cart. */
export function clearGuestCart(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Get total item count in cart. */
export function getGuestCartCount(): number {
  return getGuestCart().reduce((sum, item) => sum + item.quantity, 0);
}

/** Order IDs storage — persist placed order IDs for tracking */
const ORDER_IDS_KEY = "tisa_guest_orders";
const ORDER_SUMMARIES_KEY = "tisa_guest_order_summaries";

export interface GuestOrderSummary {
  orderId: string;
  orderNumber: string;
  guestName: string;
  total: number;
  deliveryType: "pickup" | "delivery";
  createdAt: string;
}

export function getGuestOrderIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveGuestOrderId(orderId: string): void {
  if (typeof window === "undefined") return;
  const ids = getGuestOrderIds();
  if (!ids.includes(orderId)) {
    ids.unshift(orderId);
  }
  localStorage.setItem(ORDER_IDS_KEY, JSON.stringify(ids.slice(0, 20)));
}

export function getGuestOrderSummaries(): GuestOrderSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDER_SUMMARIES_KEY);
    return raw ? (JSON.parse(raw) as GuestOrderSummary[]) : [];
  } catch {
    return [];
  }
}

export function saveGuestOrderSummary(order: GuestOrderSummary): void {
  if (typeof window === "undefined") return;
  const summaries = getGuestOrderSummaries().filter(
    (summary) => summary.orderId !== order.orderId,
  );
  localStorage.setItem(
    ORDER_SUMMARIES_KEY,
    JSON.stringify([order, ...summaries].slice(0, 20)),
  );
  window.dispatchEvent(new Event("tisa:orders-changed"));
}
