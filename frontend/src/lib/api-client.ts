// Browser-side API client. Uses credentials: "include" so the
// backend's HttpOnly session cookie is sent on every request.

import { ApiCallError, buildUrl, parseErrorBody, type ApiOptions } from "@/lib/api-shared";

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
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
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiCallError(res.status, await parseErrorBody(res));
  }
  const text = await res.text();
  return (text ? (JSON.parse(text) as unknown) : null) as T;
}

export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    body: form,
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiCallError(res.status, await parseErrorBody(res));
  }
  const text = await res.text();
  return (text ? (JSON.parse(text) as unknown) : null) as T;
}
