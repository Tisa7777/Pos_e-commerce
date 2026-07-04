"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthorizedRedirectForRoles, getRoleHome } from "@/lib/auth/constants";
import { loginWithPassword, logout, registerWithPassword } from "@/lib/services/auth";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import type { ActionState } from "@/types/domain";

function getSafeRedirectTarget(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "";
  }

  return value;
}

export async function loginAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted login fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let loginResult: Awaited<ReturnType<typeof loginWithPassword>>;

  try {
    loginResult = await loginWithPassword(parsed.data.email, parsed.data.password);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to sign in.",
    };
  }

  revalidatePath("/", "layout");
  const redirectTo = getSafeRedirectTarget(formData.get("redirectTo"));
  const roles = loginResult.profile?.roles ?? ["customer"];
  const target = getAuthorizedRedirectForRoles(roles, redirectTo || getRoleHome(roles));

  redirect(target);
}

export async function registerAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted registration fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let registerResult: Awaited<ReturnType<typeof registerWithPassword>>;

  try {
    const { email, password, fullName, phone } = parsed.data;
    registerResult = await registerWithPassword({ email, password, fullName, phone });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to create account.",
    };
  }

  revalidatePath("/", "layout");

  // If registration also signed the user in, send them to their home page.
  if (registerResult.signedIn) {
    const roles = registerResult.roles ?? ["customer"];
    redirect(getRoleHome(roles));
  }

  return {
    ok: true,
    message:
      "Account created. Check your email if confirmation is enabled, then sign in to continue.",
    fieldErrors: {},
  };
}

export async function logoutAction() {
  await logout();
  revalidatePath("/", "layout");
  redirect("/");
}
