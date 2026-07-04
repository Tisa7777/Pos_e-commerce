import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name is required.")
    .max(80, "Full name is too long."),
  phone: z
    .string()
    .trim()
    .max(32, "Phone number is too long.")
    .optional()
    .transform((value) => value || undefined),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
