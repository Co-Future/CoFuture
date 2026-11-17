import type { ApiErrorBody } from "./respond";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody["error"] };

/** Calls one of our API routes and returns data or the uniform error, never throws. */
export async function apiFetch<T = unknown>(url: string, init: { method: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    return {
      ok: false,
      error: (body as ApiErrorBody | null)?.error ?? { code: "unknown", message: "Das hat nicht geklappt." },
    };
  } catch {
    return { ok: false, error: { code: "network", message: "Keine Verbindung. Prüf dein Netz und versuch es noch einmal." } };
  }
}
