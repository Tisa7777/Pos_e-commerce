"use server";

import { requirePermission } from "@/lib/auth/guards";
import { getAnalyticsDashboardData, type DatePreset } from "@/lib/services/reports";
import type { AnalyticsDashboardData } from "@/types/domain";

const VALID_PRESETS = new Set<DatePreset>(["today", "yesterday", "this_week", "this_month"]);

export async function fetchReportDataAction(
  preset: string,
): Promise<{ ok: boolean; data?: AnalyticsDashboardData; message?: string }> {
  // Server actions are POST endpoints, so this must be guarded server-side even
  // though the dashboard component is only rendered for permitted roles.
  await requirePermission("reports", "/admin");

  try {
    if (!VALID_PRESETS.has(preset as DatePreset)) {
      return { ok: false, message: `Invalid date preset: ${preset}` };
    }

    const data = await getAnalyticsDashboardData(preset as DatePreset);
    return { ok: true, data };
  } catch (error) {
    console.error("[fetchReportDataAction] error:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to load report data",
    };
  }
}
