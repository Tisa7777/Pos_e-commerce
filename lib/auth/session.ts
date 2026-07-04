import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "tisa_session";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getSessionCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionCookieValue(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  const maxAge = Math.max(Math.floor((expiresAt.getTime() - Date.now()) / 1000), 0);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge,
    priority: "high",
  });
}

export async function clearSessionCookieValue() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}
