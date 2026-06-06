export class ApiCallError extends Error {
  readonly status: number;
  readonly detail: string;
  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in .env.local (e.g. http://localhost:8000).",
    );
  }
  return base.replace(/\/+$/, "");
}

export function buildUrl(path: string, query?: ApiOptions["query"]): string {
  const url = new URL(path, getApiBase() + "/");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function parseErrorBody(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return res.statusText;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "detail" in parsed) {
      return String((parsed as { detail: unknown }).detail);
    }
    return text;
  } catch {
    return text;
  }
}
