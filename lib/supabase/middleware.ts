import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  // Expose the current pathname to server components (read via `headers()`),
  // used for role-based route confinement (staff/clerk).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  if (!isSupabaseConfigured()) {
    return {
      response: NextResponse.next({ request: { headers: requestHeaders } }),
      userId: null as string | null,
    };
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    userId: user?.id ?? null,
  };
}
