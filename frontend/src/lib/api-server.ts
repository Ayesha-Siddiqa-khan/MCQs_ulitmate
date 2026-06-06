// Server-side API client. Forwards the browser's HttpOnly cookies to
// the FastAPI backend and re-emits any Set-Cookie headers from the
// backend onto the Next.js response.

import { cookies } from "next/headers";

import { ApiCallError, buildUrl, parseErrorBody, type ApiOptions } from "@/lib/api-shared";

async function buildHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (cookieHeader) headers.Cookie = cookieHeader;
  return headers;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers = await buildHeaders();
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.formData) {
    body = opts.formData;
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    signal: opts.signal,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiCallError(res.status, await parseErrorBody(res));
  }
  const text = await res.text();
  return (text ? (JSON.parse(text) as unknown) : null) as T;
}

export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const headers = await buildHeaders();
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: form,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiCallError(res.status, await parseErrorBody(res));
  }
  const text = await res.text();
  return (text ? (JSON.parse(text) as unknown) : null) as T;
}
