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
  ) {
    super(message);
  }
}

type Request = { system: string; user: string; jsonSchema: object };
type Provider = { name: StructuredResult<unknown>["provider"]; model: string; run: (req: Request) => Promise<unknown> };

export const GEMINI_MODEL = "gemini-3.5-flash";
export const GROQ_MODEL = "qwen/qwen3.8-27b";

function httpError(provider: string, status: number, body: string) {
  return new LlmError(`${provider} ${status}: ${body.slice(0, 200)}`, status === 429 || status >= 500);
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
    async run({ system, user, jsonSchema }) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
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
    async run({ system, user, jsonSchema }) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
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

/** Runs the request with the first provider whose output passes the schema. */
export async function generateStructured<S extends z.ZodType>(
  request: Request & { schema: S },
  providers = configuredProviders(),
): Promise<StructuredResult<z.infer<S>>> {
  if (providers.length === 0) throw new LlmError("No LLM provider configured.", false);
  let lastError: unknown;
  const failures: string[] = [];
  for (const provider of providers) {
    const start = performance.now();
    try {
      const raw = await provider.run(request);
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
      console.warn("llm provider failed", { provider: provider.name, error: String(error).slice(0, 300) });
      if (error instanceof LlmError && !error.retriable) throw error;
    }
  }
  throw lastError;
}
