"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { updateCustomerProfile } from "@/lib/services/customers";
import { updateProfileSchema } from "@/lib/validations/profile";
import type { ActionState } from "@/types/domain";

export async function updateProfileAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireUser("/account");

  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateCustomerProfile({
      profileId: profile.id,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update your profile.",
    };
  }

  revalidatePath("/", "layout");
  revalidatePath("/account");
  revalidatePath("/admin/customers");

  return {
    ok: true,
    message: "Profile updated.",
    fieldErrors: {},
  };
}
