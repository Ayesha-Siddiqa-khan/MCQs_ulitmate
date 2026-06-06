import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

export async function createClient() {
  const url = getPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
    );
  }

  // Next 16: cookies() is async.
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component (read-only). Safe to ignore —
          // the proxy refreshes the session, so RSC reads will be fresh.
        }
      },
    },
  });
}
