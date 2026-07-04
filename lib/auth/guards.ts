import { cache } from "react";
import { redirect } from "next/navigation";
import { isPostgresConfigured, isSupabaseConfigured } from "@/lib/env";
import { dbQuery } from "@/lib/db/postgres";
import { getSessionCookieValue, hashSessionToken } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizedRedirectForRoles, getRoleHome } from "@/lib/auth/constants";
import { getPermissionsForRoles, resolveStaffHome } from "@/lib/auth/permissions";
import type { AppProfile, UserRole } from "@/types/domain";

export const getCurrentProfile = cache(
  async (): Promise<AppProfile | null> => {
    if (isPostgresConfigured()) {
      const sessionToken = await getSessionCookieValue();
      if (!sessionToken) {
        return null;
      }

      const { rows } = await dbQuery<{
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        roles: Array<UserRole | null> | null;
      }>(
        `
          select
            p.id,
            p.email,
            p.full_name,
            p.phone,
            array_remove(array_agg(distinct ur.role), null)::text[] as roles
          from public.auth_sessions s
          join public.profiles p on p.id = s.profile_id
          left join public.user_roles ur on ur.profile_id = p.id
          where s.token_hash = $1
            and s.revoked_at is null
            and s.expires_at > timezone('utc', now())
          group by p.id, p.email, p.full_name, p.phone
          limit 1
        `,
        [hashSessionToken(sessionToken)],
      );

      const profile = rows[0];
      if (!profile) {
        return null;
      }

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        phone: profile.phone,
        roles: profile.roles?.filter((role): role is UserRole => Boolean(role)) ?? ["customer"],
      };
    }

    if (!isSupabaseConfigured()) {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("user_roles").select("role").eq("profile_id", user.id),
    ]);

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      roles: roles?.map((entry) => entry.role) ?? ["customer"],
    };
  },
);

export async function requireUser(redirectTo?: string) {
  const profile = await getCurrentProfile();

  if (!profile) {
    const target = redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login";
    redirect(target);
  }

  return profile;
}

export async function requireRoles(allowedRoles: UserRole[], redirectTo?: string) {
  const profile = await requireUser(redirectTo);

  if (!profile.roles.some((role) => allowedRoles.includes(role))) {
    redirect(getRoleHome(profile.roles));
  }

  return profile;
}

/**
 * Authorizes the current user against a configurable permission key.
 * Admins always pass. Non-admins lacking the permission are redirected to a
 * page they can access. Used to keep server actions in lock-step with the
 * permission matrix (defense in depth alongside layout-level checks).
 */
export async function requirePermission(permission: string, redirectTo?: string) {
  const profile = await requireUser(redirectTo);

  const permissions = await getPermissionsForRoles(profile.roles);
  if (!permissions.has(permission)) {
    redirect(resolveStaffHome(permissions, profile.roles));
  }

  return profile;
}

export async function redirectIfAuthenticated(redirectTo?: string) {
  const profile = await getCurrentProfile();

  if (profile) {
    redirect(getAuthorizedRedirectForRoles(profile.roles, redirectTo));
  }
}
