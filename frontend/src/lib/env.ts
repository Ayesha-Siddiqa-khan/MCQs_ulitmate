// Frontend env helpers.
//
// Rule: the frontend is allowed to read NEXT_PUBLIC_* values only. Those
// are inlined into the client bundle by Next.js, so they MUST be safe
// to expose. The only public value the frontend needs is the API base URL.

export function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in frontend/.env.local " +
        "(e.g. NEXT_PUBLIC_API_BASE_URL=http://localhost:8000).",
    );
  }
  return base.replace(/\/+$/, "");
}

// Defence in depth: refuse to start if any of these is set. They are
// server-only secrets and must never be exposed to the browser.
const FORBIDDEN_PUBLIC_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_JWT_SECRET",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_GOOGLE_API_KEY",
  "NEXT_PUBLIC_ENCRYPTION_KEY",
  "NEXT_PUBLIC_DATABASE_URL",
];

for (const name of FORBIDDEN_PUBLIC_VARS) {
  if (process.env[name]) {
    console.error(
      `[env] Refusing to start: "${name}" is a server-only secret. ` +
        `Move it to backend/.env and remove the NEXT_PUBLIC_ prefix.`,
    );
    throw new Error(`Server-only secret exposed via ${name}`);
  }
}
