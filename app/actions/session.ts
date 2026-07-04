"use server";

import { getCurrentProfile } from "@/lib/auth/guards";

/** Lightweight check used by client components to adapt to auth state. */
export async function getSignedInStatusAction(): Promise<{ signedIn: boolean }> {
  const profile = await getCurrentProfile();
  return { signedIn: Boolean(profile) };
}
