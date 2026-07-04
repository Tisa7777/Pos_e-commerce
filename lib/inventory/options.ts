export const INVENTORY_ADJUSTMENT_MODES = ["add", "remove"] as const;

export type InventoryAdjustmentMode = (typeof INVENTORY_ADJUSTMENT_MODES)[number];

export const ADD_STOCK_REASON_VALUES = [
  "supplier_delivery",
  "manual_recount",
  "returned_item",
  "initial_stock_entry",
  "other",
] as const;

export type AddStockReason = (typeof ADD_STOCK_REASON_VALUES)[number];

export const REMOVE_STOCK_REASON_VALUES = [
  "damaged",
  "expired",
  "theft_loss",
  "manual_recount",
  "other",
] as const;

export type RemoveStockReason = (typeof REMOVE_STOCK_REASON_VALUES)[number];

export const INVENTORY_REASON_LABELS: Record<string, string> = {
  supplier_delivery: "Supplier delivery",
  manual_recount: "Manual recount",
  returned_item: "Returned item",
  initial_stock_entry: "Initial stock entry",
  damaged: "Damaged",
  expired: "Expired",
  theft_loss: "Theft/Loss",
  other: "Other",
};

export const ADD_STOCK_REASON_OPTIONS: Array<{
  value: AddStockReason;
  label: string;
}> = [
  { value: "supplier_delivery", label: "Supplier delivery" },
  { value: "manual_recount", label: "Manual recount" },
  { value: "returned_item", label: "Returned item" },
  { value: "initial_stock_entry", label: "Initial stock entry" },
  { value: "other", label: "Other" },
];

export const REMOVE_STOCK_REASON_OPTIONS: Array<{
  value: RemoveStockReason;
  label: string;
}> = [
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "theft_loss", label: "Theft/Loss" },
  { value: "manual_recount", label: "Manual recount" },
  { value: "other", label: "Other" },
];

export function getInventoryReasonLabel(value: string) {
  return INVENTORY_REASON_LABELS[value] ?? value;
}

export function buildInventoryReasonText(reason: string, notes?: string | null) {
  if (reason === "other") {
    const detail = notes?.trim();
    return detail ? `Other: ${detail}` : "Other";
  }

  return getInventoryReasonLabel(reason);
}
