import { z } from "zod";
import { uuidLikeSchema } from "@/lib/validations/shared";

function optionalTrimmedString(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => value?.trim() || undefined);
}

export const customerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(90),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  phone: optionalTrimmedString(30),
  loyaltyPoints: z.coerce.number().int().min(0).max(999999).default(0),
  notes: optionalTrimmedString(500),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  discountExpiresAt: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Choose a valid expiry date.",
    }),
});

export const customerUpdateSchema = customerSchema.extend({
  id: uuidLikeSchema("Invalid customer ID."),
});

export const customerDiscountSchema = z.object({
  id: uuidLikeSchema("Invalid customer ID."),
  notes: optionalTrimmedString(500),
  discountPercent: z.coerce.number().min(0).max(100),
  discountExpiresAt: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Choose a valid expiry date.",
    }),
});

export const customerPointsSchema = z.object({
  id: uuidLikeSchema("Invalid customer ID."),
  pointsToAdd: z.coerce.number().int().min(1).max(100000),
});
