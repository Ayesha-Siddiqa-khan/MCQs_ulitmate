import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

// Refreshes the Supabase auth session on every request and forwards refreshed
// cookies on the response. Used by src/proxy.ts.
//
// Must NOT import next/headers; we operate on NextRequest/NextResponse instead.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = getPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: triggers any token refresh and writes the new cookies.
  await supabase.auth.getUser();

  return response;
}
