// Server-side helper: fetch the current user from the FastAPI backend.
// The browser's HttpOnly cookie is forwarded explicitly because the
// Next.js server lives on a different origin than the backend in dev.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { buildApiUrl } from "@/lib/api-shared";

export type AuthUser = { id: string; email: string | null };

async function backendGetMe(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!cookieHeader) return null;
  try {
    const res = await fetch(buildApiUrl("/auth/me"), {
      method: "GET",
      headers: { Cookie: cookieHeader, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as AuthUser;
    if (!data?.id) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return backendGetMe();
}

/**
 * Server-side auth gate. Returns the user when authenticated, otherwise
 * redirects to /login. Use in server components / server actions.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await backendGetMe();
  if (!user) redirect("/login");
  return user;
}
