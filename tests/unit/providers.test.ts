import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configuredProviders as llmProviders, LlmError } from "@/lib/ai/llm";
import { buildPerspectiveMap } from "@/lib/ai/perspective-map";
import { configuredProviders as sttProviders, SttError, transcribe } from "@/lib/stt";

/** HTTP adapters for Gemini and Groq, with fetch stubbed out. No request leaves the machine. */

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), init: init!, headers: init!.headers as Record<string, string> };
};
const request = { system: "System", user: "Antworten", jsonSchema: { type: "object" } };

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
  vi.stubEnv("GROQ_API_KEY", "test-groq-key");
  vi.stubEnv("LLM_PROVIDER", "");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("LLM providers", () => {
  it("puts Gemini first and Groq as the fallback", () => {
    expect(llmProviders().map((p) => p.name)).toEqual(["gemini", "groq"]);
  });

  it("puts Groq first with LLM_PROVIDER=groq", () => {
    vi.stubEnv("LLM_PROVIDER", "groq");
    expect(llmProviders().map((p) => p.name)).toEqual(["groq", "gemini"]);
  });

  it("only offers providers with a key", () => {
    vi.stubEnv("GEMINI_API_KEY", undefined);
    expect(llmProviders().map((p) => p.name)).toEqual(["groq"]);
  });

  it("Gemini sends the key as a header, never in the URL, and joins the answer parts", async () => {
    const [gemini] = llmProviders();
    fetchMock.mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: '{"a":' }, { text: "1}" }] } }] }));
    expect(await gemini!.run(request)).toEqual({ a: 1 });
    const { url, headers, init } = lastCall();
    expect(url).not.toContain("test-gemini-key");
    expect(headers["x-goog-api-key"]).toBe("test-gemini-key");
    expect(JSON.parse(String(init.body))).toMatchObject({ generationConfig: { responseMimeType: "application/json" } });
  });

  it("Groq sends a bearer token and reads the first choice", async () => {
    const groq = llmProviders()[1]!;
    fetchMock.mockResolvedValueOnce(json({ choices: [{ message: { content: '{"ok":true}' } }] }));
    expect(await groq.run(request)).toEqual({ ok: true });
    expect(lastCall().headers.authorization).toBe("Bearer test-groq-key");
  });

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
  ])("HTTP %i is retriable: %s", async (status, retriable) => {
    const [gemini] = llmProviders();
    fetchMock.mockResolvedValueOnce(new Response("fehler", { status }));
    const error = await gemini!.run(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).retriable).toBe(retriable);
  });

  it("treats output that is not JSON as retriable", async () => {
    const groq = llmProviders()[1]!;
    fetchMock.mockResolvedValueOnce(json({ choices: [{ message: { content: "Hier ist deine Karte:" } }] }));
    await expect(groq.run(request)).rejects.toMatchObject({ retriable: true });
  });
});

describe("buildPerspectiveMap", () => {
  it("falls back to Groq on a Gemini overload and still checks every source", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("overloaded", { status: 503 }))
      .mockResolvedValueOnce(
        json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  clusters: [{ title: "Dafür", kind: "consensus", summary: "Beide dafür.", source_ids: ["A01", "A07"] }],
                  open_questions: [],
                }),
              },
            },
          ],
        }),
      );

    const result = await buildPerspectiveMap({
      question: "Hotline testen?",
      context: null,
      responses: [
        { id: "A01", text: "Ja" },
        { id: "A02", text: "Nur mit Budget" },
      ],
    });

    expect(result).toMatchObject({ provider: "groq", promptVersion: "v1", responseCount: 2, coveredByModel: 1 });
    // A07 does not exist and is dropped; A02 was left out by the model and lands in "unassigned".
    expect(result.map.clusters.map((c) => [c.kind, c.source_ids])).toEqual([
      ["consensus", ["A01"]],
      ["unassigned", ["A02"]],
    ]);
    const sent = JSON.parse(String(lastCall().init.body)) as { messages: { role: string; content: string }[] };
    expect(sent.messages[1]!.content).toContain('<response id="A02">Nur mit Budget</response>');
  });
});

describe("speech-to-text providers", () => {
  it("puts Groq Whisper first and Gemini as the fallback", () => {
    expect(sttProviders().map((p) => p.name)).toEqual(["groq", "gemini"]);
  });

  it("Groq transcribes German and names the file after the format", async () => {
    const [groq] = sttProviders();
    fetchMock.mockResolvedValueOnce(json({ text: "Hallo Team" }));
    expect(await groq!.run(new Blob(["x"]), "audio/webm;codecs=opus")).toBe("Hallo Team");
    const form = lastCall().init.body as FormData;
    expect(form.get("language")).toBe("de");
    expect((form.get("file") as File).name).toBe("answer.webm");
  });

  it("Gemini sends the audio inline without codec parameters", async () => {
    const gemini = sttProviders()[1]!;
    fetchMock.mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: "Hallo" }] } }] }));
    expect(await gemini.run(new Blob(["abc"]), "audio/ogg;codecs=opus")).toBe("Hallo");
    const body = JSON.parse(String(lastCall().init.body));
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: "audio/ogg", data: Buffer.from("abc").toString("base64") });
  });

  it("marks overload as retriable and bad audio as final", async () => {
    const [groq] = sttProviders();
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 503 }));
    await expect(groq!.run(new Blob(["x"]), "audio/webm")).rejects.toMatchObject({ retriable: true });
    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 400 }));
    await expect(groq!.run(new Blob(["x"]), "audio/webm")).rejects.toBeInstanceOf(SttError);
  });

  it("falls back on network errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    fetchMock.mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: "Reserve" }] } }] }));
    expect(await transcribe(new Blob(["x"]), "audio/webm")).toMatchObject({ text: "Reserve", provider: "gemini" });
  });
});
