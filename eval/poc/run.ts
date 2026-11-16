// PoC (throwaway code): compares speech-to-text and the perspective map across providers.
// Run: node --experimental-strip-types eval/poc/run.ts   (keys from .env.local)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { question, responses, spokenAnswer } from "./data.ts";
import { perspectiveMapJsonSchema, perspectiveMapSchema, systemPrompt, type PerspectiveMap } from "./schema.ts";

process.loadEnvFile(".env.local");
const GROQ = process.env.GROQ_API_KEY!;
const GEMINI = process.env.GEMINI_API_KEY!;
const OUT = "eval/poc/results";
mkdirSync(OUT, { recursive: true });

const RUNS = 3;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// 1. Test audio: Gemini TTS → raw PCM → Opus in Ogg at 32 kbit/s (our planned speech quality)
// ---------------------------------------------------------------------------
async function makeTestAudio(): Promise<string> {
  const ogg = `${OUT}/answer.ogg`;
  if (existsSync(ogg)) return ogg;
  const data = await postJson(
    `${GEMINI_BASE}/gemini-2.5-flash-preview-tts:generateContent`,
    {
      contents: [{ parts: [{ text: `Sprich ruhig und natürlich auf Deutsch: ${spokenAnswer}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    },
    { "x-goog-api-key": GEMINI },
  );
  const pcm = Buffer.from(data.candidates[0].content.parts[0].inlineData.data, "base64");
  writeFileSync(`${OUT}/answer.pcm`, pcm);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", `${OUT}/answer.pcm`, "-c:a", "libopus", "-b:a", "32k", ogg]);
  return ogg;
}

// ---------------------------------------------------------------------------
// 2. Speech-to-text
// ---------------------------------------------------------------------------
async function groqTranscribe(file: string, model: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(file)], { type: "audio/ogg" }), "answer.ogg");
  form.append("model", model);
  form.append("language", "de");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${GROQ}` },
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()).text;
}

async function geminiTranscribe(file: string, model: string): Promise<string> {
  const data = await postJson(
    `${GEMINI_BASE}/${model}:generateContent`,
    {
      contents: [{ parts: [
        { inline_data: { mime_type: "audio/ogg", data: readFileSync(file).toString("base64") } },
        { text: "Transkribiere diese deutsche Sprachaufnahme wörtlich. Gib nur den Text aus." },
      ] }],
      generationConfig: { temperature: 0 },
    },
    { "x-goog-api-key": GEMINI },
  );
  return data.candidates[0].content.parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-zäöüß0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
}

/** Word error rate: word-level edit distance divided by the reference length. */
function wer(reference: string, hypothesis: string): number {
  const ref = words(reference);
  const hyp = words(hypothesis);
  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const cur = [i];
    for (let j = 1; j <= hyp.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[hyp.length] / ref.length;
}

// ---------------------------------------------------------------------------
// 3. Perspective map
// ---------------------------------------------------------------------------
const userPrompt =
  `Frage der Runde: ${question}\n\nAntworten:\n` +
  responses.map((r) => `<response id="${r.id}">${r.text}</response>`).join("\n");

async function groqMap(model: string): Promise<{ json: unknown; tokens: number }> {
  const data = await postJson(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model,
      temperature: 0.1,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_schema", json_schema: { name: "perspective_map", schema: perspectiveMapJsonSchema, strict: model.startsWith("openai/") } },
    },
    { authorization: `Bearer ${GROQ}` },
  );
  return { json: JSON.parse(data.choices[0].message.content), tokens: data.usage?.total_tokens ?? 0 };
}

async function geminiMap(model: string): Promise<{ json: unknown; tokens: number }> {
  const data = await postJson(
    `${GEMINI_BASE}/${model}:generateContent`,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseJsonSchema: perspectiveMapJsonSchema },
    },
    { "x-goog-api-key": GEMINI },
  );
  const text = data.candidates[0].content.parts.map((p: { text?: string }) => p.text ?? "").join("");
  return { json: JSON.parse(text), tokens: data.usageMetadata?.totalTokenCount ?? 0 };
}

type MapCheck = {
  schemaOk: boolean;
  coverage: number;
  unknownIds: string[];
  injectionKind: string;
  minorityKind: string;
  offTopicKind: string;
  clusters: number;
};

function checkMap(raw: unknown): MapCheck {
  const parsed = perspectiveMapSchema.safeParse(raw);
  if (!parsed.success) {
    return { schemaOk: false, coverage: 0, unknownIds: [], injectionKind: "-", minorityKind: "-", offTopicKind: "-", clusters: 0 };
  }
  const map: PerspectiveMap = parsed.data;
  const known = new Set(responses.map((r) => r.id));
  const cited = new Set(map.clusters.flatMap((c) => c.source_ids));
  const kindOf = (id: string) => map.clusters.filter((c) => c.source_ids.includes(id)).map((c) => c.kind).join("+") || "fehlt";
  return {
    schemaOk: true,
    coverage: [...known].filter((id) => cited.has(id)).length / known.size,
    unknownIds: [...cited, ...map.open_questions.flatMap((q) => q.source_ids)].filter((id) => !known.has(id)),
    injectionKind: kindOf("R13"),
    minorityKind: kindOf("R07"),
    offTopicKind: kindOf("R15"),
    clusters: map.clusters.length,
  };
}

// ---------------------------------------------------------------------------
// Run everything and write the report
// ---------------------------------------------------------------------------
const lines: string[] = [];
const log = (s = "") => { console.log(s); lines.push(s); };

const audio = await makeTestAudio();
const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio]).toString().trim());
const kb = Math.round(readFileSync(audio).length / 1024);

log(`## Speech-to-Text (${seconds.toFixed(0)} s Testaudio, Opus 32 kbit/s, ${kb} KB)`);
log();
log("| Anbieter / Modell | Dauer | Wortfehlerrate |");
log("| --- | --- | --- |");
const sttRuns: [string, () => Promise<string>][] = [
  ["Groq whisper-large-v3", () => groqTranscribe(audio, "whisper-large-v3")],
  ["Groq whisper-large-v3-turbo", () => groqTranscribe(audio, "whisper-large-v3-turbo")],
  ["Gemini 3.5 Flash", () => geminiTranscribe(audio, "gemini-3.5-flash")],
  ["Gemini 3.5 Flash-Lite", () => geminiTranscribe(audio, "gemini-3.5-flash-lite")],
];
for (const [name, fn] of sttRuns) {
  try {
    const { value, ms } = await timed(fn);
    writeFileSync(`${OUT}/stt-${name.replace(/\W+/g, "-")}.txt`, value);
    log(`| ${name} | ${(ms / 1000).toFixed(1)} s | ${(wer(spokenAnswer, value) * 100).toFixed(1)} % |`);
  } catch (e) {
    log(`| ${name} | Fehler | ${(e as Error).message.slice(0, 80)} |`);
  }
}

log();
log(`## Perspektivenkarte (15 Antworten, ${RUNS} Läufe je Modell)`);
log();
log("| Anbieter / Modell | Lauf | Dauer | Tokens | Schema | Abdeckung | Erfundene IDs | Cluster | Injection (R13) | Einzelstimme (R07) | Off-Topic (R15) |");
log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
const mapRuns: [string, () => Promise<{ json: unknown; tokens: number }>][] = [
  ["Groq gpt-oss-120b", () => groqMap("openai/gpt-oss-120b")],
  ["Groq qwen3.8-27b", () => groqMap("qwen/qwen3.8-27b")],
  ["Gemini 3.5 Flash", () => geminiMap("gemini-3.5-flash")],
  ["Gemini 3.5 Flash-Lite", () => geminiMap("gemini-3.5-flash-lite")],
];
for (const [name, fn] of mapRuns) {
  for (let run = 1; run <= RUNS; run++) {
    try {
      const { value, ms } = await timed(fn);
      writeFileSync(`${OUT}/map-${name.replace(/\W+/g, "-")}-${run}.json`, JSON.stringify(value.json, null, 2));
      const c = checkMap(value.json);
      log(`| ${name} | ${run} | ${(ms / 1000).toFixed(1)} s | ${value.tokens} | ${c.schemaOk ? "ok" : "ungültig"} | ${Math.round(c.coverage * 100)} % | ${c.unknownIds.length} | ${c.clusters} | ${c.injectionKind} | ${c.minorityKind} | ${c.offTopicKind} |`);
    } catch (e) {
      log(`| ${name} | ${run} | Fehler | | | | | | ${(e as Error).message.slice(0, 60).replace(/\|/g, "/")} | | |`);
    }
  }
}

writeFileSync(`${OUT}/report-table.md`, lines.join("\n") + "\n");
