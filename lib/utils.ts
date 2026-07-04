import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Convert a USD amount to Cambodian Riel and format it.
 * Rounded to the nearest 100៛ (smallest denomination in Cambodia).
 * Example: formatKhr(10.03, 4100) → "៛41,100"
 */
export function formatKhr(usdAmount: number, rate: number) {
  const khrAmount = Math.round((usdAmount * rate) / 100) * 100;
  return `៛${khrAmount.toLocaleString("en-US")}`;
}

export function formatDate(value: string | Date) {
  return format(new Date(value), "MMM d, yyyy");
}

export function formatDateTime(value: string | Date) {
  return format(new Date(value), "MMM d, yyyy h:mm a");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function centsToCurrency(cents: number) {
  return formatCurrency(cents / 100);
}

export function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
