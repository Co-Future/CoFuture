import { afterEach, describe, expect, it, vi } from "vitest";
import { embedTexts, EmbedError, knowledgeText, normalize, toVectorLiteral } from "@/lib/ai/embed";

describe("embedding helpers", () => {
  it("normalizes to unit length", () => {
    const v = normalize([3, 4]);
    expect(v).toEqual([0.6, 0.8]);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });

  it("writes a pgvector literal", () => {
    expect(toVectorLiteral([0.1, -2, 3])).toBe("[0.1,-2,3]");
  });

  it("represents an item by question, title and content", () => {
    expect(knowledgeText({ question: "Passt Donnerstag?", title: "Termin passt", content: "Fast alle können." })).toBe(
      "Frage: Passt Donnerstag?\nTermin passt\nFast alle können.",
    );
  });
});

describe("embedTexts", () => {
  const vector = (seed: number) => Array.from({ length: 768 }, (_, i) => (i === 0 ? seed : 0));

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("batches by 100 and keeps the order", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const calls: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const { requests } = JSON.parse(init.body) as { requests: { content: { parts: { text: string }[] } }[] };
        calls.push(requests.length);
        return new Response(
          JSON.stringify({ embeddings: requests.map((r) => ({ values: vector(Number(r.content.parts[0].text)) })) }),
        );
      }),
    );
    const texts = Array.from({ length: 150 }, (_, i) => String(i + 1));
    const out = await embedTexts(texts, "RETRIEVAL_DOCUMENT");
    expect(calls).toEqual([100, 50]);
    expect(out).toHaveLength(150);
    expect(out[149][0]).toBe(1); // normalized
  });

  it("marks rate limits as worth retrying and bad requests as not", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("slow down", { status: 429 })),
    );
    await expect(embedTexts(["a"], "RETRIEVAL_DOCUMENT")).rejects.toMatchObject({ retriable: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad", { status: 400 })),
    );
    await expect(embedTexts(["a"], "RETRIEVAL_DOCUMENT")).rejects.toMatchObject({ retriable: false });
  });

  it("rejects vectors of the wrong size", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ embeddings: [{ values: [1, 2, 3] }] }))),
    );
    await expect(embedTexts(["a"], "RETRIEVAL_DOCUMENT")).rejects.toBeInstanceOf(EmbedError);
  });
});
