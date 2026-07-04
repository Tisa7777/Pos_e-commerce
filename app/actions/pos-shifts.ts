"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { closePosShift, openPosShift } from "@/lib/services/pos-shifts";
import {
  closePosShiftSchema,
  openPosShiftSchema,
} from "@/lib/validations/pos-shifts";
import type { ActionState, PosShiftSummary } from "@/types/domain";

function revalidatePosShiftPaths() {
  revalidatePath("/pos");
  revalidatePath("/pos/cart");
  revalidatePath("/pos/checkout");
  revalidatePath("/pos/history");
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/orders");
}

export async function openPosShiftAction(
  input: unknown,
): Promise<ActionState<PosShiftSummary>> {
  const profile = await requirePermission("pos", "/pos");
  const parsed = openPosShiftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please enter valid opening cash before opening the shift.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const shift = await openPosShift(profile, {
      cashierName: parsed.data.cashierName,
      cashierProfileId: parsed.data.cashierProfileId || undefined,
      openingCash: parsed.data.openingCash,
      notes: parsed.data.notes,
    });

    revalidatePosShiftPaths();

    return {
      ok: true,
      message: "Shift opened.",
      data: shift,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to open shift.",
    };
  }
}

export async function closePosShiftAction(
  input: unknown,
): Promise<ActionState<PosShiftSummary>> {
  const profile = await requirePermission("pos", "/pos");
  const parsed = closePosShiftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please enter valid counted cash before closing the shift.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const shift = await closePosShift(profile, {
      shiftId: parsed.data.shiftId,
      closingCash: parsed.data.closingCash,
      notes: parsed.data.notes,
    });

    revalidatePosShiftPaths();

    return {
      ok: true,
      message: "Shift closed.",
      data: shift,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to close shift.",
    };
  }
}
