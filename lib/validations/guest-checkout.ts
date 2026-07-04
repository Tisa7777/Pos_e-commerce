import { z } from "zod";

export const guestCheckoutSchema = z
  .object({
    guestName: z.string().trim().min(1, "Full name is required.").max(120),
    guestPhone: z.string().trim().min(1, "Phone number is required.").max(30),
    guestEmail: z.string().trim().email("Enter a valid email.").max(120).optional().or(z.literal("")),
    deliveryType: z.enum(["pickup", "delivery"]),
    deliveryAddress: z.string().trim().max(300).optional().or(z.literal("")),
    couponCode: z.string().trim().max(40).optional().or(z.literal("")),
    paymentMethod: z.enum(["cash", "qr"]),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    items: z
      .array(
        z.object({
          product_id: z.string().min(1),
          name: z.string().min(1),
          price: z.number().nonnegative(),
          size: z.enum(["M", "L"]).nullable().optional(),
          ice: z.enum(["No ice", "Less ice", "Normal ice", "Extra ice"]).nullable().optional(),
          sweet: z.enum(["0%", "25%", "50%", "75%", "100%"]).nullable().optional(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1, "Cart is empty."),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryType === "delivery" && !data.deliveryAddress?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Delivery address is required.",
        path: ["deliveryAddress"],
      });
    }
  });

export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

export const guestOrderTrackingSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .min(6, "Enter an order number.")
    .max(40, "Order number is too long.")
    .regex(/^[a-zA-Z0-9-]+$/, "Use only letters, numbers, and dashes."),
});

export type GuestOrderTrackingInput = z.infer<typeof guestOrderTrackingSchema>;
