"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { logout } from "@/lib/services/auth";

export async function staffLogoutAction() {
  await logout();
  revalidatePath("/", "layout");
  redirect("/login?redirectTo=/admin");
}
