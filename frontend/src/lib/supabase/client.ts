import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

export function createClient() {
  const url = getPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
    );
  }
  return createBrowserClient(url, anonKey);
}
