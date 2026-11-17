import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { fieldErrors } from "@/lib/validation/auth";

/** Uniform error body for every API route: { error: { code, message, fields? } }. */
export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

export function apiError(status: number, code: string, message: string, fields?: Record<string, string>) {
  return Response.json({ error: { code, message, ...(fields ? { fields } : {}) } } satisfies ApiErrorBody, { status });
}

/** Parses and validates a JSON body. Returns the data or a ready-made 400 response. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: apiError(400, "invalid_json", "Die Anfrage ist kein gültiges JSON.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error) as Record<string, string>;
    return { response: apiError(400, "validation_failed", "Bitte prüf deine Eingaben.", fields) };
  }
  return { data: parsed.data };
}

/** The signed-in user's id, or a ready-made 401 response. */
export async function requireUserId(supabase: SupabaseClient): Promise<{ userId: string } | { response: Response }> {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { response: apiError(401, "unauthenticated", "Bitte melde dich an.") };
  return { userId };
}
