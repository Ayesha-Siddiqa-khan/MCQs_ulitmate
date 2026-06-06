import { createClient } from "@/lib/supabase/client";
import { ApiCallError, buildUrl, parseErrorBody, type ApiOptions } from "@/lib/api-shared";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...(await getAuthHeaders()) };
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
  const headers = await getAuthHeaders();
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
