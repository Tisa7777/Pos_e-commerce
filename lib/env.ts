const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";
const EXAMPLE_SUPABASE_URL = "https://your-project-ref.supabase.co";
const EXAMPLE_SUPABASE_ANON_KEY = "your-anon-key";
const EXAMPLE_DATABASE_URL = "postgresql://postgres:password@localhost:5432/tisa_pos";
const EXAMPLE_SESSION_SECRET = "replace-with-a-long-random-secret";

function hasConfiguredValue(value: string | undefined, placeholders: string[]) {
  if (!value) {
    return false;
  }

  return !placeholders.includes(value.trim());
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

export function getSessionSecret() {
  return process.env.SESSION_SECRET;
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? PLACEHOLDER_URL;
}

export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PLACEHOLDER_KEY;
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function isSupabaseConfigured() {
  return (
    hasConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_URL, [
      PLACEHOLDER_URL,
      EXAMPLE_SUPABASE_URL,
    ]) &&
    hasConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, [
      PLACEHOLDER_KEY,
      EXAMPLE_SUPABASE_ANON_KEY,
    ])
  );
}

export function isPostgresConfigured() {
  if (isSupabaseConfigured()) {
    return false;
  }

  return (
    hasConfiguredValue(process.env.DATABASE_URL, [EXAMPLE_DATABASE_URL]) &&
    hasConfiguredValue(process.env.SESSION_SECRET, [EXAMPLE_SESSION_SECRET])
  );
}

export function isBackendConfigured() {
  return isPostgresConfigured() || isSupabaseConfigured();
}

export function isDemoDataEnabled() {
  return process.env.USE_DEMO_DATA === "true";
}

export function getBackendConfigurationMessage(feature = "This feature") {
  return `${feature} requires a real backend. Configure DATABASE_URL and SESSION_SECRET for PostgreSQL, or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for Supabase.`;
}

export function requireBackendConfigured(feature?: string) {
  if (!isBackendConfigured()) {
    throw new Error(getBackendConfigurationMessage(feature));
  }
}

export function requireSupabaseConfigured(feature = "This feature") {
  if (!isSupabaseConfigured()) {
    throw new Error(
      `${feature} requires Supabase. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`,
    );
  }
}
