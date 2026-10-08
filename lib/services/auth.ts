import { createHmac } from "node:crypto";
import { addDays } from "date-fns";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import {
  getSessionSecret,
  isPostgresConfigured,
  isSupabaseConfigured,
  requireBackendConfigured,
} from "@/lib/env";
import {
  clearSessionCookieValue,
  createSessionToken,
  getSessionCookieValue,
  hashSessionToken,
  setSessionCookieValue,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import type { AppProfile, UserRole } from "@/types/domain";

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
const DUMMY_PASSWORD_HASH = "$2b$10$wi7wBfWBzLHKGNP/BMxqLuSkk7Mh1BdPCQwEzD0SWu.w3R7b.8dEu";
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_WINDOW_SQL = "15 minutes";
const LOGIN_EMAIL_FAILURE_LIMIT = 5;
const LOGIN_IP_FAILURE_LIMIT = 20;
const LOGIN_ATTEMPT_RETENTION_SQL = "24 hours";

declare global {
  var __tisaLoginFailureBuckets: Map<string, number[]> | undefined;
}

interface LoginRequestFingerprint {
  ipHash: string | null;
  userAgentHash: string | null;
}

let ensuredPostgresAuthSecuritySchema = false;

export async function loginWithPassword(email: string, password: string) {
  const normalizedEmail = normalizeAuthEmail(email);
  const fingerprint = await getLoginRequestFingerprint();

  if (isPostgresConfigured()) {
    await assertLoginAllowed(normalizedEmail, fingerprint);

    const { rows } = await dbQuery<{
      id: string;
      email: string;
      full_name: string;
      phone: string | null;
      password_hash: string | null;
      roles: Array<UserRole | null> | null;
    }>(
      `
        select
          p.id,
          p.email,
          p.full_name,
          p.phone,
          p.password_hash,
          array_remove(array_agg(distinct ur.role), null)::text[] as roles
        from public.profiles p
        left join public.user_roles ur on ur.profile_id = p.id
        where lower(p.email) = lower($1)
        group by p.id, p.email, p.full_name, p.phone, p.password_hash
        limit 1
      `,
      [normalizedEmail],
    );

    const profile = rows[0];
    const passwordHash = profile?.password_hash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, passwordHash);

    if (!profile?.password_hash || !passwordMatches) {
      await recordLoginFailure(
        normalizedEmail,
        fingerprint,
        profile?.id ?? null,
        "invalid_credentials",
      );
      throw new Error(INVALID_LOGIN_MESSAGE);
    }

    const sessionToken = createSessionToken();
    const expiresAt = addDays(new Date(), 30);

    await dbQuery(
      `
        insert into public.auth_sessions (profile_id, token_hash, expires_at)
        values ($1, $2, $3)
      `,
      [profile.id, hashSessionToken(sessionToken), expiresAt.toISOString()],
    );

    await recordLoginSuccess(normalizedEmail, fingerprint, profile.id);
    await setSessionCookieValue(sessionToken, expiresAt);

    return {
      ok: true,
      message: "Signed in successfully.",
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        phone: profile.phone,
        roles: normalizeRoles(profile.roles),
      },
    };
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Sign in");
  }

  await assertLoginAllowed(normalizedEmail, fingerprint);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    await recordLoginFailure(normalizedEmail, fingerprint, null, "invalid_credentials");
    throw new Error(INVALID_LOGIN_MESSAGE);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unable to verify the signed-in account.");
  }

  const profile = await getSupabaseLoginProfile(supabase, user);

  await recordLoginSuccess(normalizedEmail, fingerprint, null);

  return {
    ok: true,
    message: "Signed in successfully.",
    profile,
  };
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}) {
  const normalizedEmail = normalizeAuthEmail(input.email);

  if (isPostgresConfigured()) {
    const passwordHash = await hashPassword(input.password);
    let newProfileId: string | null = null;

    try {
      await withDbTransaction(async (client) => {
        const profileResult = await client.query<{ id: string }>(
          `
            insert into public.profiles (email, full_name, phone, password_hash)
            values ($1, $2, $3, $4)
            returning id
          `,
          [normalizedEmail, input.fullName, input.phone || null, passwordHash],
        );

        const profileId = profileResult.rows[0]?.id;
        if (!profileId) {
          throw new Error("Unable to create account.");
        }

        newProfileId = profileId;

        await client.query(
          `
            insert into public.user_roles (profile_id, role)
            values ($1, 'customer')
          `,
          [profileId],
        );

        await client.query(
          `
            insert into public.customers (profile_id, full_name, email, phone)
            values ($1, $2, $3, $4)
            on conflict (profile_id) do update
              set full_name = excluded.full_name,
                  email = excluded.email,
                  phone = excluded.phone
          `,
          [profileId, input.fullName, normalizedEmail, input.phone || null],
        );
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account.";
      if (message.includes("profiles_email_key")) {
        throw new Error("An account with that email already exists.");
      }

      throw error;
    }

    // Sign the new customer in immediately so the account is ready to use.
    if (newProfileId) {
      const sessionToken = createSessionToken();
      const expiresAt = addDays(new Date(), 30);

      await dbQuery(
        `
          insert into public.auth_sessions (profile_id, token_hash, expires_at)
          values ($1, $2, $3)
        `,
        [newProfileId, hashSessionToken(sessionToken), expiresAt.toISOString()],
      );

      await setSessionCookieValue(sessionToken, expiresAt);
    }

    return {
      ok: true,
      message: "Account created. You're signed in now.",
      signedIn: true,
      roles: ["customer"] as UserRole[],
    };
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Account registration");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        phone: input.phone,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.user) {
    await syncSupabaseCustomerAccount({
      id: data.user.id,
      email: normalizedEmail,
      fullName: input.fullName,
      phone: input.phone || null,
      activateCustomer: true,
    });
  }

  return {
    ok: true,
    message: "Check your inbox to confirm the account if email confirmation is enabled.",
    signedIn: false,
    roles: ["customer"] as UserRole[],
  };
}

export async function logout() {
  if (isPostgresConfigured()) {
    const sessionToken = await getSessionCookieValue();
    if (sessionToken) {
      await dbQuery(
        `
          update public.auth_sessions
          set revoked_at = timezone('utc', now())
          where token_hash = $1
        `,
        [hashSessionToken(sessionToken)],
      );
    }

    await clearSessionCookieValue();
    return;
  }

  if (!isSupabaseConfigured()) {
    await clearSessionCookieValue();
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function listProfileAddresses(profileId: string) {
  // Saved addresses are not part of the PostgreSQL schema; the storefront
  // collects delivery details inline during guest checkout. Kept as a typed
  // no-op for any callers expecting the old Supabase shape.
  void profileId;
  return [] as Array<{
    id: string;
    label: string | null;
    recipientName: string | null;
    phone: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  }>;
}

function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function normalizeRoles(roles: Array<string | null> | null | undefined): UserRole[] {
  const normalized = Array.from(
    new Set((roles ?? []).filter((role): role is UserRole => isUserRole(role))),
  );
  return normalized.length ? normalized : ["customer"];
}

function isUserRole(role: string | null | undefined): role is UserRole {
  return typeof role === "string" && /^[a-z][a-z0-9_]{1,39}$/.test(role);
}

function isCustomerOnlyAccount(roles: UserRole[]) {
  return roles.includes("customer") && !roles.some((role) => role !== "customer");
}

function getUserMetadataString(user: User, key: string) {
  const value = user.user_metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function createOptionalSupabaseServiceRoleClient() {
  try {
    return createSupabaseServiceRoleClient();
  } catch {
    return null;
  }
}

async function syncSupabaseCustomerAccount(input: {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  activateCustomer: boolean;
}) {
  const serviceClient = createOptionalSupabaseServiceRoleClient();

  if (!serviceClient) {
    return;
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: input.id,
      email: input.email,
      full_name: input.fullName,
      phone: input.phone || null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error("Unable to prepare your account profile.");
  }

  const { error: roleError } = await serviceClient
    .from("user_roles")
    .upsert({ profile_id: input.id, role: "customer" }, { onConflict: "profile_id,role" });

  if (roleError) {
    throw new Error("Unable to prepare your account permissions.");
  }

  const { error: customerError } = await serviceClient.from("customers").upsert(
    {
      profile_id: input.id,
      full_name: input.fullName,
      email: input.email,
      phone: input.phone || null,
      ...(input.activateCustomer ? { is_active: true } : {}),
    },
    { onConflict: "profile_id" },
  );

  if (customerError) {
    throw new Error("Unable to prepare your customer record.");
  }
}

async function getSupabaseLoginProfile(
  supabase: SupabaseServerClient,
  user: User,
): Promise<AppProfile | null> {
  const serviceClient = createOptionalSupabaseServiceRoleClient();
  const profileClient = serviceClient ?? supabase;

  const profileResult = await profileClient
    .from("profiles")
    .select("id, email, full_name, phone")
    .eq("id", user.id)
    .maybeSingle();
  let profile = profileResult.data;

  if (profileResult.error) {
    throw new Error("Unable to load your account profile.");
  }

  if (!profile && serviceClient && user.email) {
    await syncSupabaseCustomerAccount({
      id: user.id,
      email: user.email,
      fullName: getUserMetadataString(user, "full_name") || user.email.split("@")[0] || "Customer",
      phone: getUserMetadataString(user, "phone") || null,
      activateCustomer: true,
    });

    const { data: createdProfile, error: createProfileError } = await serviceClient
      .from("profiles")
      .select("id, email, full_name, phone")
      .eq("id", user.id)
      .single();

    if (createProfileError) {
      throw new Error("Unable to load your account profile.");
    }

    profile = createdProfile;
  }

  if (!profile) {
    return null;
  }

  const { data: roles, error: rolesError } = await profileClient
    .from("user_roles")
    .select("role")
    .eq("profile_id", user.id);

  if (rolesError) {
    throw new Error("Unable to load your account permissions.");
  }

  const normalizedRoles = normalizeRoles(roles?.map((entry) => entry.role));

  if (serviceClient && user.email && isCustomerOnlyAccount(normalizedRoles)) {
    await syncSupabaseCustomerAccount({
      id: user.id,
      email: profile.email ?? user.email,
      fullName: profile.full_name,
      phone: profile.phone,
      activateCustomer: true,
    });
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    phone: profile.phone,
    roles: normalizedRoles,
  };
}

async function getLoginRequestFingerprint(): Promise<LoginRequestFingerprint> {
  const headerStore = await headers();
  const clientIp =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("cf-connecting-ip")?.trim() ||
    null;
  const userAgent = headerStore.get("user-agent")?.trim() || null;

  return {
    ipHash: hashLoginIdentifier(clientIp),
    userAgentHash: hashLoginIdentifier(userAgent),
  };
}

function hashLoginIdentifier(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const secret =
    getSessionSecret() ??
    process.env.AUTH_THROTTLE_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "local-dev-login-throttle";

  return createHmac("sha256", secret).update(value).digest("hex");
}

async function ensurePostgresAuthSecuritySchema() {
  if (ensuredPostgresAuthSecuritySchema) {
    return;
  }

  await dbQuery(`
    create table if not exists public.auth_login_attempts (
      id uuid primary key default gen_random_uuid(),
      email_hash text not null,
      profile_id uuid references public.profiles (id) on delete set null,
      ip_hash text,
      user_agent_hash text,
      success boolean not null default false,
      failure_reason text,
      attempted_at timestamptz not null default timezone('utc', now())
    );

    create index if not exists idx_auth_login_attempts_email_failed
      on public.auth_login_attempts (email_hash, attempted_at desc)
      where success = false;

    create index if not exists idx_auth_login_attempts_ip_failed
      on public.auth_login_attempts (ip_hash, attempted_at desc)
      where success = false and ip_hash is not null;
  `);

  ensuredPostgresAuthSecuritySchema = true;
}

async function assertLoginAllowed(email: string, fingerprint: LoginRequestFingerprint) {
  if (isPostgresConfigured()) {
    await assertPostgresLoginAllowed(email, fingerprint);
    return;
  }

  assertMemoryLoginAllowed(email, fingerprint);
}

async function assertPostgresLoginAllowed(
  email: string,
  fingerprint: LoginRequestFingerprint,
) {
  await ensurePostgresAuthSecuritySchema();
  await prunePostgresLoginAttempts();

  const emailHash = hashLoginIdentifier(email);
  if (!emailHash) {
    return;
  }

  const { rows } = await dbQuery<{
    email_failures: string | number;
    ip_failures: string | number;
    retry_at: Date | string | null;
  }>(
    `
      with recent as (
        select email_hash, ip_hash, attempted_at
        from public.auth_login_attempts
        where success = false
          and attempted_at > timezone('utc', now()) - $3::interval
          and (
            email_hash = $1
            or ($2::text is not null and ip_hash = $2::text)
          )
      ),
      counts as (
        select
          count(*) filter (where email_hash = $1) as email_failures,
          max(attempted_at) filter (where email_hash = $1) as email_latest,
          count(*) filter (where $2::text is not null and ip_hash = $2::text) as ip_failures,
          max(attempted_at) filter (where $2::text is not null and ip_hash = $2::text) as ip_latest
        from recent
      )
      select
        email_failures,
        ip_failures,
        nullif(
          greatest(
            coalesce(
              case when email_failures >= $4::int then email_latest + $3::interval end,
              '-infinity'::timestamptz
            ),
            coalesce(
              case when ip_failures >= $5::int then ip_latest + $3::interval end,
              '-infinity'::timestamptz
            )
          ),
          '-infinity'::timestamptz
        ) as retry_at
      from counts
    `,
    [
      emailHash,
      fingerprint.ipHash,
      LOGIN_RATE_LIMIT_WINDOW_SQL,
      LOGIN_EMAIL_FAILURE_LIMIT,
      LOGIN_IP_FAILURE_LIMIT,
    ],
  );

  throwIfRetryIsActive(rows[0]?.retry_at ?? null);
}

async function recordLoginFailure(
  email: string,
  fingerprint: LoginRequestFingerprint,
  profileId: string | null,
  reason: string,
) {
  if (isPostgresConfigured()) {
    await recordPostgresLoginAttempt(email, fingerprint, false, profileId, reason);
    return;
  }

  recordMemoryLoginFailure(email, fingerprint);
}

async function recordLoginSuccess(
  email: string,
  fingerprint: LoginRequestFingerprint,
  profileId: string | null,
) {
  if (isPostgresConfigured()) {
    await recordPostgresLoginAttempt(email, fingerprint, true, profileId, null);
    await clearPostgresLoginFailures(email);
    return;
  }

  clearMemoryLoginFailures(email, fingerprint);
}

async function recordPostgresLoginAttempt(
  email: string,
  fingerprint: LoginRequestFingerprint,
  success: boolean,
  profileId: string | null,
  failureReason: string | null,
) {
  await ensurePostgresAuthSecuritySchema();
  const emailHash = hashLoginIdentifier(email);

  if (!emailHash) {
    return;
  }

  await dbQuery(
    `
      insert into public.auth_login_attempts (
        email_hash,
        profile_id,
        ip_hash,
        user_agent_hash,
        success,
        failure_reason
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [
      emailHash,
      profileId,
      fingerprint.ipHash,
      fingerprint.userAgentHash,
      success,
      failureReason,
    ],
  );
}

async function clearPostgresLoginFailures(email: string) {
  const emailHash = hashLoginIdentifier(email);
  if (!emailHash) {
    return;
  }

  // Scoped to this email only. Clearing by ip_hash as well would let one
  // successful sign-in reset the brute-force counters for every other account
  // being attacked from the same address.
  await dbQuery(
    `
      delete from public.auth_login_attempts
      where success = false
        and email_hash = $1
    `,
    [emailHash],
  );
}

async function prunePostgresLoginAttempts() {
  await dbQuery(
    `
      delete from public.auth_login_attempts
      where attempted_at < timezone('utc', now()) - $1::interval
    `,
    [LOGIN_ATTEMPT_RETENTION_SQL],
  );
}

function getMemoryLoginFailureBuckets() {
  global.__tisaLoginFailureBuckets ??= new Map<string, number[]>();
  return global.__tisaLoginFailureBuckets;
}

function getMemoryLoginKeys(email: string, fingerprint: LoginRequestFingerprint) {
  const emailHash = hashLoginIdentifier(email);
  return [
    emailHash ? { key: `email:${emailHash}`, limit: LOGIN_EMAIL_FAILURE_LIMIT } : null,
    fingerprint.ipHash
      ? { key: `ip:${fingerprint.ipHash}`, limit: LOGIN_IP_FAILURE_LIMIT }
      : null,
  ].filter((entry): entry is { key: string; limit: number } => Boolean(entry));
}

function assertMemoryLoginAllowed(email: string, fingerprint: LoginRequestFingerprint) {
  const buckets = getMemoryLoginFailureBuckets();
  const now = Date.now();
  const retryAt = getMemoryLoginKeys(email, fingerprint).reduce<number | null>(
    (latestRetryAt, { key, limit }) => {
      const failures = trimMemoryFailures(buckets.get(key) ?? [], now);
      buckets.set(key, failures);

      if (failures.length < limit) {
        return latestRetryAt;
      }

      const bucketRetryAt = failures[failures.length - 1]! + LOGIN_RATE_LIMIT_WINDOW_MS;
      return latestRetryAt === null ? bucketRetryAt : Math.max(latestRetryAt, bucketRetryAt);
    },
    null,
  );

  throwIfRetryIsActive(retryAt);
}

function recordMemoryLoginFailure(email: string, fingerprint: LoginRequestFingerprint) {
  const buckets = getMemoryLoginFailureBuckets();
  const now = Date.now();

  for (const { key } of getMemoryLoginKeys(email, fingerprint)) {
    const failures = trimMemoryFailures(buckets.get(key) ?? [], now);
    failures.push(now);
    buckets.set(key, failures);
  }
}

function clearMemoryLoginFailures(email: string, fingerprint: LoginRequestFingerprint) {
  const buckets = getMemoryLoginFailureBuckets();

  for (const { key } of getMemoryLoginKeys(email, fingerprint)) {
    buckets.delete(key);
  }
}

function trimMemoryFailures(failures: number[], now: number) {
  return failures.filter((timestamp) => now - timestamp <= LOGIN_RATE_LIMIT_WINDOW_MS);
}

function throwIfRetryIsActive(retryAt: Date | string | number | null) {
  if (!retryAt) {
    return;
  }

  const retryTime =
    retryAt instanceof Date
      ? retryAt.getTime()
      : typeof retryAt === "number"
        ? retryAt
        : new Date(retryAt).getTime();

  if (!Number.isFinite(retryTime) || retryTime <= Date.now()) {
    return;
  }

  const minutes = Math.max(1, Math.ceil((retryTime - Date.now()) / 60_000));
  throw new Error(
    `Too many sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  );
}
