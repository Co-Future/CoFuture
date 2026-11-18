import type { z } from "zod";
import { serverEnv } from "@/lib/env";

/** LLM adapter with structured output (ADR 005): Gemini first, Groq as free fallback. */

export type StructuredResult<T> = {
  data: T;
  /** Unvalidated model output, kept for debugging (no personal data: the input holds pseudonyms only). */
  raw: unknown;
  provider: "gemini" | "groq";
  model: string;
  ms: number;
  /** Providers that failed before this one, e.g. "gemini: gemini 403: …". Empty when the first one worked. */
  failures: string[];
};

export class LlmError extends Error {
  constructor(
    message: string,
    /** Worth trying the next provider (rate limit, overload, network, unusable output). */
    readonly retriable: boolean,
    /** Overloaded or timed out: pause this provider for a while. */
    readonly overloaded = false,
  ) {
    super(message);
  }
}

type Request = {
  system: string;
  user: string;
  jsonSchema: object;
  /** Per provider. After this the next provider takes over, so nothing hangs until Vercel kills the function. */
  timeoutMs?: number;
};
type Provider = {
  name: StructuredResult<unknown>["provider"];
  model: string;
  run: (req: Request, signal?: AbortSignal) => Promise<unknown>;
};

const DEFAULT_TIMEOUT_MS = 20_000;
/** A provider that timed out or reported overload is skipped for a while (per function instance). */
const COOLDOWN_MS = 2 * 60_000;
const cooldownUntil = new Map<string, number>();

/** For tests: forget which providers are paused. */
export function resetProviderCooldown() {
  cooldownUntil.clear();
}

export const GEMINI_MODEL = "gemini-3.5-flash";
export const GROQ_MODEL = "qwen/qwen3.8-27b";

function httpError(provider: string, status: number, body: string) {
  const overloaded = status === 429 || status >= 500;
  return new LlmError(`${provider} ${status}: ${body.slice(0, 200)}`, overloaded, overloaded);
}

function parseJson(provider: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new LlmError(`${provider}: response is not valid JSON`, true);
  }
}

function gemini(apiKey: string): Provider {
  return {
    name: "gemini",
    model: GEMINI_MODEL,
    async run({ system, user, jsonSchema }, signal) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseJsonSchema: jsonSchema },
        }),
      });
      if (!res.ok) throw httpError("gemini", res.status, await res.text());
      const body = await res.json();
      const parts: { text?: string }[] = body.candidates?.[0]?.content?.parts ?? [];
      return parseJson("gemini", parts.map((p) => p.text ?? "").join(""));
    },
  };
}

function groq(apiKey: string): Provider {
  return {
    name: "groq",
    model: GROQ_MODEL,
    async run({ system, user, jsonSchema }, signal) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.1,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_schema", json_schema: { name: "result", schema: jsonSchema, strict: false } },
        }),
      });
      if (!res.ok) throw httpError("groq", res.status, await res.text());
      const body = await res.json();
      return parseJson("groq", String(body.choices?.[0]?.message?.content ?? ""));
    },
  };
}

/** Providers in order. LLM_PROVIDER=groq puts Groq first (tests, saving the Gemini quota). */
export function configuredProviders(): Provider[] {
  const env = serverEnv();
  const list: Provider[] = [];
  if (env.GEMINI_API_KEY) list.push(gemini(env.GEMINI_API_KEY));
  if (env.GROQ_API_KEY) list.push(groq(env.GROQ_API_KEY));
  return process.env.LLM_PROVIDER === "groq" ? list.reverse() : list;
}

/**
 * Runs the request with the first provider whose output passes the schema.
 * Each provider gets `timeoutMs`; a provider that times out or is overloaded (429, 5xx) is paused for
 * two minutes, so the next requests go straight to the fallback. If all are paused, all are tried.
 */
export async function generateStructured<S extends z.ZodType>(
  request: Request & { schema: S },
  providers = configuredProviders(),
): Promise<StructuredResult<z.infer<S>>> {
  if (providers.length === 0) throw new LlmError("No LLM provider configured.", false);
  let lastError: unknown;
  const failures: string[] = [];
  const now = Date.now();
  const active = providers.filter((p) => (cooldownUntil.get(p.name) ?? 0) <= now);
  for (const p of providers) if (!active.includes(p) && active.length > 0) failures.push(`${p.name}: übersprungen, Pause nach Ausfall`);
  for (const provider of active.length > 0 ? active : providers) {
    const start = performance.now();
    try {
      const raw = await withTimeout(provider, request);
      const parsed = request.schema.safeParse(raw);
      if (!parsed.success) throw new LlmError(`${provider.name}: output does not match the schema`, true);
      return {
        data: parsed.data,
        raw,
        provider: provider.name,
        model: provider.model,
        ms: Math.round(performance.now() - start),
        failures,
      };
    } catch (error) {
      lastError = error;
      failures.push(`${provider.name}: ${String(error).slice(0, 300)}`);
      if (error instanceof LlmError && error.overloaded) cooldownUntil.set(provider.name, Date.now() + COOLDOWN_MS);
      console.warn("llm provider failed", { provider: provider.name, error: String(error).slice(0, 300) });
      if (error instanceof LlmError && !error.retriable) throw error;
    }
  }
  throw lastError;
}

async function withTimeout(provider: Provider, request: Request): Promise<unknown> {
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    return await provider.run(request, AbortSignal.timeout(timeoutMs));
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new LlmError(`${provider.name}: no answer within ${timeoutMs} ms`, true, true);
    }
    throw error;
  }
}
