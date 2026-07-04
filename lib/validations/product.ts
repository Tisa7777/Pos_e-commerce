import { z } from "zod";
import { uuidLikeSchema } from "@/lib/validations/shared";

export const productSchema = z.object({
  name: z.string().min(2, "Product name is required."),
  description: z.string().optional(),
  sku: z.string().min(2, "SKU is required."),
  barcode: z.string().optional(),
  categoryId: uuidLikeSchema("Choose a category.").optional().or(z.literal("")),
  supplierId: uuidLikeSchema("Choose a supplier.").optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price must be zero or more."),
  cost: z.coerce.number().min(0, "Cost must be zero or more."),
  stockQuantity: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
  isActive: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

export const productUpdateSchema = productSchema.extend({
  id: uuidLikeSchema("Invalid product selection."),
});

export const productStatusSchema = z.object({
  id: uuidLikeSchema("Invalid product selection."),
  isActive: z.boolean(),
});
