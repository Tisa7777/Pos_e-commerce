"use server";

import { getAnalyticsDashboardData, type DatePreset } from "@/lib/services/reports";
import type { AnalyticsDashboardData } from "@/types/domain";

const VALID_PRESETS = new Set<DatePreset>(["today", "yesterday", "this_week", "this_month"]);

export async function fetchReportDataAction(
  preset: string,
): Promise<{ ok: boolean; data?: AnalyticsDashboardData; message?: string }> {
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
