export type DrinkSize = "M" | "L";

export const DRINK_SIZES: DrinkSize[] = ["M", "L"];
export const DEFAULT_DRINK_SIZE: DrinkSize = "M";
export const LARGE_DRINK_UPCHARGE = 1;

export type DrinkIce = "No ice" | "Less ice" | "Normal ice" | "Extra ice";
export const ICE_LEVELS: DrinkIce[] = ["No ice", "Less ice", "Normal ice", "Extra ice"];
export const DEFAULT_ICE: DrinkIce = "Normal ice";

export type DrinkSweet = "0%" | "25%" | "50%" | "75%" | "100%";
export const SWEET_LEVELS: DrinkSweet[] = ["0%", "25%", "50%", "75%", "100%"];
export const DEFAULT_SWEET: DrinkSweet = "100%";

type ProductWithCategory = {
  category?: {
    name?: string | null;
    slug?: string | null;
  } | null;
};

export function isDrinkProduct(product: ProductWithCategory) {
  const category = `${product.category?.slug ?? ""} ${product.category?.name ?? ""}`.toLowerCase();
  return (
    category.includes("coffee") ||
    category.includes("tea") ||
    category.includes("drink")
  );
}

export function isStockTrackedProduct(product: ProductWithCategory) {
  return !isDrinkProduct(product);
}

export function getDrinkSizePrice(basePrice: number, size?: DrinkSize | null) {
  return basePrice + (size === "L" ? LARGE_DRINK_UPCHARGE : 0);
}

export function getCartLineLabel(
  name: string,
  size?: DrinkSize | null,
  ice?: DrinkIce | null,
  sweet?: DrinkSweet | null,
) {
  const parts: string[] = [];
  if (size) parts.push(size);
  if (ice) parts.push(ice);
  if (sweet) parts.push(`${sweet} sweet`);
  return parts.length > 0 ? `${name} (${parts.join(" · ")})` : name;
}
