export const PREMIUM_ICON_NAMES = [
  "accessories",
  "all-sales",
  "alert",
  "arrow-right",
  "avg-order",
  "bakery",
  "bell",
  "bar-chart",
  "camera",
  "card",
  "cart",
  "cash",
  "check",
  "chevron-right",
  "close",
  "coffee",
  "csv",
  "customers",
  "delete",
  "delivery",
  "drink",
  "edit",
  "fast",
  "file",
  "folder",
  "fresh",
  "heart",
  "home",
  "low-stock",
  "mail",
  "minus",
  "online",
  "orders",
  "package",
  "payment",
  "pdf",
  "phone",
  "plus",
  "pos",
  "print",
  "product-links",
  "qr",
  "rated",
  "receipt",
  "revenue",
  "rocket",
  "search",
  "store",
  "supplies",
  "trophy",
  "thumbs-up",
  "time",
  "music",
  "view",
] as const;

export type PremiumIconName = (typeof PREMIUM_ICON_NAMES)[number];

export const CATEGORY_ICON_OPTIONS: Array<{
  name: PremiumIconName;
  label: string;
}> = [
  { name: "coffee", label: "Coffee" },
  { name: "drink", label: "Tea and drinks" },
  { name: "bakery", label: "Bakery" },
  { name: "accessories", label: "Accessories" },
  { name: "package", label: "General goods" },
  { name: "folder", label: "Category" },
  { name: "supplies", label: "Supplies" },
];

export function isPremiumIconName(value?: string | null): value is PremiumIconName {
  return PREMIUM_ICON_NAMES.includes(value as PremiumIconName);
}

export function toPremiumIconName(
  value: string | null | undefined,
  fallback: PremiumIconName = "package",
) {
  return isPremiumIconName(value) ? value : fallback;
}

export function getProductIconName(
  productName?: string | null,
  categoryName?: string | null,
): PremiumIconName {
  const name = productName?.toLowerCase() ?? "";
  const category = categoryName?.toLowerCase() ?? "";

  if (
    name.includes("croissant") ||
    name.includes("bakery") ||
    name.includes("bread") ||
    name.includes("pastry") ||
    category.includes("bakery")
  ) {
    return "bakery";
  }

  if (
    name.includes("milk tea") ||
    name.includes("tea") ||
    name.includes("smoothie") ||
    name.includes("soda")
  ) {
    return "drink";
  }

  if (
    name.includes("coffee") ||
    name.includes("latte") ||
    name.includes("espresso") ||
    name.includes("cappuccino") ||
    category.includes("coffee")
  ) {
    return "coffee";
  }

  if (
    name.includes("tumbler") ||
    name.includes("travel") ||
    name.includes("bag") ||
    category.includes("accessor") ||
    category.includes("merch")
  ) {
    return "accessories";
  }

  return "package";
}

export function getCategoryIconName(
  categoryName?: string | null,
  preferredIconName?: string | null,
): PremiumIconName {
  const preferred = toPremiumIconName(preferredIconName, "package");

  if (preferredIconName && preferred !== "package") {
    return preferred;
  }

  const category = categoryName?.toLowerCase() ?? "";

  if (category.includes("bakery")) {
    return "bakery";
  }

  if (category.includes("coffee")) {
    return "coffee";
  }

  if (category.includes("tea") || category.includes("drink")) {
    return "drink";
  }

  if (category.includes("accessor") || category.includes("merch")) {
    return "accessories";
  }

  return preferred;
}

export function getPaymentIconName(method?: string | null): PremiumIconName {
  const normalized = method?.toLowerCase() ?? "";

  if (normalized.includes("cash")) {
    return "cash";
  }

  if (normalized.includes("qr")) {
    return "qr";
  }

  if (normalized.includes("card")) {
    return "card";
  }

  return "payment";
}

export function getChannelIconName(source?: string | null): PremiumIconName {
  return source === "pos" ? "pos" : "online";
}
