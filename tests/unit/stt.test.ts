import { describe, expect, it } from "vitest";
import { SttError, transcribe } from "@/lib/stt";
import { baseMime, voiceJobSchema } from "@/lib/validation/voice";

const audio = new Blob(["x"], { type: "audio/webm" });
const provider = (name: "groq" | "gemini", run: () => Promise<string>) => ({ name, model: `${name}-model`, run });

describe("transcribe", () => {
  it("uses the first provider when it works", async () => {
    const result = await transcribe(audio, "audio/webm", [provider("groq", async () => "  Hallo  "), provider("gemini", async () => "nie")]);
    expect(result).toMatchObject({ text: "Hallo", provider: "groq" });
  });

  it("falls back on rate limits and overload", async () => {
    const result = await transcribe(audio, "audio/webm", [
      provider("groq", async () => {
        throw new SttError("groq 429", true);
      }),
      provider("gemini", async () => "Reserve"),
    ]);
    expect(result).toMatchObject({ text: "Reserve", provider: "gemini" });
  });

  it("does not fall back on errors that would repeat (e.g. bad audio)", async () => {
    await expect(
      transcribe(audio, "audio/webm", [
        provider("groq", async () => {
          throw new SttError("groq 400", false);
        }),
        provider("gemini", async () => "nie"),
      ]),
    ).rejects.toThrow("groq 400");
  });

  it("fails clearly without any provider", async () => {
    await expect(transcribe(audio, "audio/webm", [])).rejects.toThrow(/No speech-to-text provider/);
  });
});

describe("voice validation", () => {
  const user = "11111111-1111-1111-1111-111111111111";
  const file = "22222222-2222-2222-2222-222222222222";

  it("strips codec parameters", () => {
    expect(baseMime("audio/webm;codecs=opus")).toBe("audio/webm");
  });

  it("accepts an upload path in the user's folder", () => {
    expect(voiceJobSchema.safeParse({ path: `${user}/${file}.webm`, mime: "audio/webm", durationMs: 42_000 }).success).toBe(true);
  });

  it("rejects path tricks, unknown formats and overlong recordings", () => {
    expect(voiceJobSchema.safeParse({ path: `../${file}.webm`, mime: "audio/webm", durationMs: 1 }).success).toBe(false);
    expect(voiceJobSchema.safeParse({ path: `${user}/${file}.exe`, mime: "audio/webm", durationMs: 1 }).success).toBe(false);
    expect(voiceJobSchema.safeParse({ path: `${user}/${file}.webm`, mime: "video/mp4", durationMs: 1 }).success).toBe(false);
    expect(voiceJobSchema.safeParse({ path: `${user}/${file}.webm`, mime: "audio/webm", durationMs: 200_000 }).success).toBe(false);
  });
});
