import { z } from "zod";
import {
  ADD_STOCK_REASON_VALUES,
  INVENTORY_ADJUSTMENT_MODES,
  REMOVE_STOCK_REASON_VALUES,
} from "@/lib/inventory/options";
import { uuidLikeSchema } from "@/lib/validations/shared";

export const inventoryAdjustmentSchema = z.object({
  mode: z.enum(INVENTORY_ADJUSTMENT_MODES),
  productId: uuidLikeSchema("Invalid product ID."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  reason: z.string().min(1, "Reason is required."),
  notes: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value?.trim() || undefined),
}).superRefine((value, context) => {
  const allowedReasons =
    value.mode === "add" ? ADD_STOCK_REASON_VALUES : REMOVE_STOCK_REASON_VALUES;

  if (!(allowedReasons as readonly string[]).includes(value.reason)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Select a valid stock adjustment reason.",
    });
  }

  if (value.reason === "other" && !value.notes?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["notes"],
      message: "Add a short note when using Other.",
    });
  }
});
