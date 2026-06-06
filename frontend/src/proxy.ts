import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Next 16 renamed middleware.ts -> proxy.ts and the export from `middleware` to `proxy`.
// Run on every path except static assets and Next internals. Auth-gating happens
// in individual server components / route handlers — this file only refreshes
// the Supabase session.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
