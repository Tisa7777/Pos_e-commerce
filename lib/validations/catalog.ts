import { z } from "zod";
import { uuidLikeSchema } from "@/lib/validations/shared";

const hexColorPattern = /^#([0-9a-fA-F]{6})$/;

function optionalTrimmedString(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => value?.trim() || undefined);
}

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(60),
  description: optionalTrimmedString(280),
  visualIcon: optionalTrimmedString(32),
  accentColor: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => !value || hexColorPattern.test(value), {
      message: "Choose a valid color.",
    }),
});

export const categoryUpdateSchema = categorySchema.extend({
  id: uuidLikeSchema("Invalid category ID."),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required.").max(80),
  contactName: optionalTrimmedString(80),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => !value || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  phone: optionalTrimmedString(30),
  notes: optionalTrimmedString(500),
  productIds: z.array(uuidLikeSchema("Invalid product ID.")).default([]),
});

export const supplierUpdateSchema = supplierSchema.extend({
  id: uuidLikeSchema("Invalid supplier ID."),
});
