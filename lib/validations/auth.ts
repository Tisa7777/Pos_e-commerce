import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.").max(128, "Password is too long."),
});

const registerPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[a-z]/, "Password needs a lowercase letter.")
  .regex(/[A-Z]/, "Password needs an uppercase letter.")
  .regex(/[0-9]/, "Password needs a number.");

export const registerSchema = z
  .object({
    email: loginSchema.shape.email,
    password: registerPasswordSchema,
    confirmPassword: z
      .string()
      .min(1, "Confirm your password.")
      .max(128, "Password confirmation is too long."),
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
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
