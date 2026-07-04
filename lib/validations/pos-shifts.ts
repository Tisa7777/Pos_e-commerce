import { z } from "zod";
import { uuidLikeSchema } from "@/lib/validations/shared";

export const openPosShiftSchema = z.object({
  cashierName: z.string().trim().min(1, "Select a cashier.").max(120),
  cashierProfileId: uuidLikeSchema("Invalid cashier ID.").optional().or(z.literal("")),
  openingCash: z.coerce.number().min(0, "Opening cash cannot be negative.").max(999999),
  notes: z.string().trim().max(500).optional(),
});

export const closePosShiftSchema = z.object({
  shiftId: uuidLikeSchema("Invalid shift ID."),
  closingCash: z.coerce.number().min(0, "Closing cash cannot be negative.").max(999999),
  notes: z.string().trim().max(500).optional(),
});
