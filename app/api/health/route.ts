import { NextResponse } from "next/server";
import {
  isBackendConfigured,
  isPostgresConfigured,
  isSupabaseConfigured,
} from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "coffee-shop-pos-commerce",
    backendConfigured: isBackendConfigured(),
    postgresConfigured: isPostgresConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
}
