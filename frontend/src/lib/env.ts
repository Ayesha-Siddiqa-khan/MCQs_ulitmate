const FORBIDDEN_PUBLIC_VARS = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_JWT_SECRET",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_GOOGLE_API_KEY",
  "NEXT_PUBLIC_ENCRYPTION_KEY",
  "NEXT_PUBLIC_DATABASE_URL",
];

// Defence-in-depth: if a developer accidentally puts a secret in a
// NEXT_PUBLIC_* var, we want a loud failure at module load instead of
// silently shipping the secret to the browser bundle. Runs once per
// server start and once per client bundle.
function assertNoSecretInPublicEnv(): void {
  for (const name of FORBIDDEN_PUBLIC_VARS) {
    if (process.env[name]) {
      // eslint-disable-next-line no-console
      console.error(
        `[env] Refusing to start: "${name}" is a server-only secret. ` +
          `Move it to backend/.env and remove the NEXT_PUBLIC_ prefix.`,
      );
      throw new Error(`Server-only secret exposed via ${name}`);
    }
  }
}
assertNoSecretInPublicEnv();

export function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getOptionalEnv(name: string): string | undefined {
  return process.env[name];
}

export function getPublicEnv(name: string): string | undefined {
  // Next 16 exposes NEXT_PUBLIC_* on both server and client. Only ever use
  // this for values that are safe to ship to the browser (Supabase URL,
  // anon/publishable key, public backend URL).
  if (!name.startsWith("NEXT_PUBLIC_")) {
    throw new Error(
      `getPublicEnv() called with non-public var "${name}". ` +
        `Server-only values must be read on the server via getEnv() / process.env.`,
    );
  }
  return process.env[name];
}
