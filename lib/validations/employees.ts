import { z } from "zod";
import { uuidLikeSchema } from "@/lib/validations/shared";

const employeeRoles = ["admin", "manager", "cashier", "inventory"] as const;
const employeeStatuses = ["active", "on_leave", "inactive"] as const;
const employeePayTypes = ["salary", "hourly", "commission"] as const;
const workDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function optionalTrimmedString(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => value?.trim() || undefined);
}

const optionalEmailSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value?.trim() || undefined)
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "Enter a valid email address.",
  });

const optionalDateSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value?.trim() || undefined)
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: "Choose a valid date.",
  });

const optionalTimeSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value?.trim() || undefined)
  .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
    message: "Use HH:MM time format.",
  });

const optionalPasswordSchema = z
  .string()
  .nullish()
  .transform((value) => (value ? value : undefined))
  .refine((value) => !value || value.length >= 8, {
    message: "Password must be at least 8 characters.",
  });

// Roles that get a real sign-in account (profile + password + user role).
const loginRoles: ReadonlyArray<(typeof employeeRoles)[number]> = [
  "admin",
  "cashier",
  "inventory",
  "manager",
];

const employeeBaseSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: optionalEmailSchema,
  phone: optionalTrimmedString(30),
  role: z.enum(employeeRoles),
  status: z.enum(employeeStatuses),
  payType: z.enum(employeePayTypes),
  salaryAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  hourlyRate: z.coerce.number().min(0).max(10_000).default(0),
  workDays: z.array(z.enum(workDays)).default([]),
  shiftStart: optionalTimeSchema,
  shiftEnd: optionalTimeSchema,
  startDate: optionalDateSchema,
  emergencyContact: optionalTrimmedString(160),
  address: optionalTrimmedString(240),
  notes: optionalTrimmedString(700),
  password: optionalPasswordSchema,
});

function requireLoginEmail(data: z.infer<typeof employeeBaseSchema>, ctx: z.RefinementCtx) {
  if (!loginRoles.includes(data.role)) {
    return;
  }

  if (!data.email) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: "Email is required so this staff member can sign in.",
    });
  }
}

// On create, login roles need an email and password so a login can be made.
export const employeeSchema = employeeBaseSchema.superRefine((data, ctx) => {
  requireLoginEmail(data, ctx);

  if (!loginRoles.includes(data.role)) {
    return;
  }

  if (!data.password) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["password"],
      message: "Set a password so this staff member can sign in.",
    });
  }
});

// On update, email is still required for login roles. Password is optional and
// only changes the login when provided.
export const employeeUpdateSchema = employeeBaseSchema
  .extend({
    id: uuidLikeSchema("Invalid employee ID."),
  })
  .superRefine(requireLoginEmail);

export const employeeDeleteSchema = z.object({
  id: uuidLikeSchema("Invalid employee ID."),
});
