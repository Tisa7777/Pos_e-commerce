import { z } from "zod";
import { uuidLikeSchema } from "@/lib/validations/shared";

const posItemSchema = z.object({
  productId: uuidLikeSchema("Invalid product ID."),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  productName: z.string().min(1),
  sku: z.string().min(1),
});

export const posCheckoutSchema = z.object({
  customerId: uuidLikeSchema("Invalid customer ID.").optional().or(z.literal("")),
  discountAmount: z.coerce.number().min(0).max(999999).default(0),
  paymentMethod: z.enum(["cash", "card", "qr", "bank_transfer"]),
  notes: z.string().max(500).optional(),
  cashierName: z.string().trim().max(120).optional(),
  cashierProfileId: uuidLikeSchema("Invalid cashier ID.").optional().or(z.literal("")),
  posShiftId: uuidLikeSchema("Invalid shift ID.").optional().or(z.literal("")),
  displaySubtotal: z.coerce.number().min(0).max(999999).optional(),
  displayTax: z.coerce.number().min(0).max(999999).optional(),
  displayTotal: z.coerce.number().min(0).max(999999).optional(),
  taxRate: z.coerce.number().min(0).max(1).optional(),
  cashReceived: z.coerce.number().min(0).max(999999).optional(),
  changeGiven: z.coerce.number().min(0).max(999999).optional(),
  itemsJson: z.string().min(2, "Add at least one item to the POS cart."),
});

export function parsePosItems(rawItems: string) {
  const parsed = JSON.parse(rawItems);
  return z.array(posItemSchema).min(1).parse(parsed);
}
