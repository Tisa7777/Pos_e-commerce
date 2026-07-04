"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import {
  getStoreSettings,
  saveStoreSettings,
} from "@/lib/services/currency-settings";

export async function updateCurrencySettingsAction(formData: FormData) {
  await requirePermission("settings", "/admin/settings");

  const khrRate = Number(formData.get("khrRate"));
  const showKhr = formData.get("showKhr") === "on";
  const taxPercent = Number(formData.get("taxPercent"));

  if (!Number.isFinite(khrRate) || khrRate <= 0) {
    return { ok: false, message: "Exchange rate must be a positive number." };
  }

  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
    return { ok: false, message: "Tax rate must be between 0% and 100%." };
  }

  await saveStoreSettings({ khrRate, showKhr, taxPercent });

  revalidatePath("/admin/settings");
  revalidatePath("/pos");
  revalidatePath("/pos/checkout");
  revalidatePath("/shop");

  return { ok: true, message: "Settings saved successfully." };
}

export async function loadCurrencySettingsAction() {
  return getStoreSettings();
}
