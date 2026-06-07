// Server actions for auth. Each one talks to the FastAPI backend,
// then mirrors the Set-Cookie headers from the backend onto the
// outgoing Next.js response so the browser keeps the session cookie.

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getApiBase } from "@/lib/env";

export type AuthResult = { error?: string; success?: string; retryAfterSeconds?: number } | undefined;

async function callAuth(
  path: string,
  body: { email: string; password: string },
): Promise<{ user: { id: string; email: string | null } | null; error: string | null }> {
  let res: Response;
  try {
    res = await fetch(new URL(path, getApiBase() + "/"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
  // Always mirror Set-Cookie (login/signup/logout all set or clear them).
  await mirrorSetCookie(res);

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const parsed = (await res.json()) as { detail?: string };
      if (parsed?.detail) detail = parsed.detail;
    } catch {
      /* non-JSON body */
    }
    return { user: null, error: detail };
  }
  if (res.status === 204) return { user: null, error: null };
  try {
    const user = (await res.json()) as { id: string; email: string | null };
    return { user, error: null };
  } catch (e) {
    return { user: null, error: (e as Error).message };
  }
}

async function mirrorSetCookie(res: Response): Promise<void> {
  // Node's undici fetch exposes set-cookie via res.headers.getSetCookie().
  const setCookies: string[] =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as { getSetCookie: () => string[] }).getSetCookie()
      : [];
  if (setCookies.length === 0) return;

  const jar = await cookies();
  for (const raw of setCookies) {
    const [pair, ...attrParts] = raw.split(";").map((s) => s.trim());
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);

    const attrs: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
      expires?: Date;
    } = {};
    for (const a of attrParts) {
      const [k, v] = a.split("=").map((s) => s.trim());
      const key = k.toLowerCase();
      if (key === "httponly") attrs.httpOnly = true;
      else if (key === "secure") attrs.secure = true;
      else if (key === "samesite") {
        const s = v.toLowerCase();
        if (s === "lax" || s === "strict" || s === "none") attrs.sameSite = s;
      } else if (key === "path") attrs.path = v;
      else if (key === "max-age") attrs.maxAge = Number(v);
      else if (key === "expires") {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) attrs.expires = d;
      }
    }

    if (value === "" || /^(deleted|null|expired)$/i.test(value)) {
      jar.delete(name);
    } else {
      jar.set(name, value, attrs);
    }
  }
}

export async function signInAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const { user, error } = await callAuth("/auth/login", { email, password });
  if (error) return { error };
  if (!user) return { error: "Invalid email or password." };
  redirect("/dashboard");
}

export async function signUpAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email) return { error: "Email is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const { user, error } = await callAuth("/auth/signup", { email, password });
  if (error) {
    const retryAfterSeconds = error.toLowerCase().includes("signup email limit") ? 300 : undefined;
    return { error, retryAfterSeconds };
  }
  if (!user?.id) {
    // No session: account created but email confirmation required.
    return { success: "Account created. Check your email to confirm before signing in." };
  }
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  try {
    const res = await fetch(new URL("/auth/logout", getApiBase() + "/"), {
      method: "POST",
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
      cache: "no-store",
    });
    await mirrorSetCookie(res);
  } catch {
    // best-effort: also clear locally
  }
  const jar = await cookies();
  jar.delete("mcq_access_token");
  jar.delete("mcq_refresh_token");
  redirect("/login");
}
