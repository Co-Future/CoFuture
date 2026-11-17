import { serverEnv } from "@/lib/env";

/** Speech-to-text adapter (ADR 004): Groq Whisper first, Gemini as fallback. */

export type Transcript = { text: string; provider: "groq" | "gemini"; model: string; ms: number };

export class SttError extends Error {
  constructor(
    message: string,
    /** Worth trying the next provider (rate limit, overload, network). */
    readonly retriable: boolean,
  ) {
    super(message);
  }
}

type Provider = {
  name: Transcript["provider"];
  model: string;
  run: (audio: Blob, mime: string, hint?: string) => Promise<string>;
};

/** Whisper reads at most 224 prompt tokens; a few hundred characters of question text are plenty. */
const MAX_HINT_CHARS = 600;

/**
 * Vocabulary hint for the speech model: the round's question and context. Terms like "RDB" are
 * then spelled the way the team writes them. Only the question text goes out, never personal data.
 */
export function transcriptionHint(question: string, context?: string | null): string {
  return [question, context].filter(Boolean).join("\n").replace(/\s+/g, " ").trim().slice(0, MAX_HINT_CHARS);
}

const GROQ_MODEL = "whisper-large-v3-turbo";
const GEMINI_MODEL = "gemini-3.5-flash";

function httpError(provider: string, status: number, body: string): SttError {
  return new SttError(`${provider} ${status}: ${body.slice(0, 200)}`, status === 429 || status >= 500);
}

function groq(apiKey: string): Provider {
  return {
    name: "groq",
    model: GROQ_MODEL,
    async run(audio, mime, hint) {
      const ext = mime.split("/")[1]?.split(";")[0] ?? "webm";
      const form = new FormData();
      form.append("file", audio, `answer.${ext}`);
      form.append("model", GROQ_MODEL);
      form.append("language", "de");
      form.append("response_format", "json");
      if (hint) form.append("prompt", hint);
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) throw httpError("groq", res.status, await res.text());
      return String((await res.json()).text ?? "");
    },
  };
}

function gemini(apiKey: string): Provider {
  return {
    name: "gemini",
    model: GEMINI_MODEL,
    async run(audio, mime, hint) {
      const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mime.split(";")[0], data } },
                {
                  text:
                    "Transkribiere diese deutsche Sprachaufnahme wörtlich. Gib nur den Text aus." +
                    (hint ? ` Die Aufnahme antwortet auf diese Frage, schreib Fachbegriffe so wie dort: ${hint}` : ""),
                },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      });
      if (!res.ok) throw httpError("gemini", res.status, await res.text());
      const body = await res.json();
      const parts: { text?: string }[] = body.candidates?.[0]?.content?.parts ?? [];
      return parts.map((p) => p.text ?? "").join("");
    },
  };
}

export function configuredProviders(): Provider[] {
  const env = serverEnv();
  const providers: Provider[] = [];
  if (env.GROQ_API_KEY) providers.push(groq(env.GROQ_API_KEY));
  if (env.GEMINI_API_KEY) providers.push(gemini(env.GEMINI_API_KEY));
  return providers;
}

/** Transcribes with the first provider that works. Retriable errors fall through to the next one. */
export async function transcribe(
  audio: Blob,
  mime: string,
  providers = configuredProviders(),
  hint?: string,
): Promise<Transcript> {
  if (providers.length === 0) throw new SttError("No speech-to-text provider configured.", false);
  let lastError: unknown;
  for (const provider of providers) {
    const start = performance.now();
    try {
      const text = (await provider.run(audio, mime, hint)).trim();
      return { text, provider: provider.name, model: provider.model, ms: Math.round(performance.now() - start) };
    } catch (error) {
      lastError = error;
      const retriable = error instanceof SttError ? error.retriable : true; // network errors
      if (!retriable) throw error;
    }
  }
  throw lastError;
}
