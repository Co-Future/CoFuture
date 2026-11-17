import { beforeEach, describe, expect, it, vi } from "vitest";
import { argsOf, fakeClient, JOB, ROUND, USER, type FakeClient } from "./support/fake-supabase";

const state = vi.hoisted(() => ({ admin: null as unknown }));

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => state.admin }));
vi.mock("@/lib/stt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stt")>()),
  transcribe: vi.fn(),
}));
vi.mock("@/lib/ai/perspective-map", () => ({ buildPerspectiveMap: vi.fn() }));

import { buildPerspectiveMap } from "@/lib/ai/perspective-map";
import { LlmError } from "@/lib/ai/llm";
import { runAnalyzeJobs } from "@/lib/jobs/analyze";
import { runTranscribeJobs, sweepOldAudio } from "@/lib/jobs/transcribe";
import { SttError, transcribe } from "@/lib/stt";

const path = `${USER}/99999999-9999-4999-8999-999999999999.webm`;
const voiceJob = (attempts = 1) => ({ id: JOB, kind: "transcribe", round_id: ROUND, attempts, payload: { path, mime: "audio/webm" } });
const jobUpdate = (admin: FakeClient) => argsOf(admin, "analysis_jobs", "update")?.[0] as { status: string; error?: string };

function setAdmin(admin: FakeClient) {
  state.admin = admin;
  admin.bucket.download.mockResolvedValue({ data: new Blob(["audio"], { type: "audio/webm" }), error: null });
  return admin;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runTranscribeJobs", () => {
  it("stores the transcript in the job and deletes the audio right away", async () => {
    const admin = setAdmin(fakeClient({ rpc: { claim_jobs: [{ data: [voiceJob()] }] } }));
    vi.mocked(transcribe).mockResolvedValueOnce({ text: "Ich bin dafür.", provider: "groq", model: "whisper", ms: 900 });

    expect(await runTranscribeJobs()).toEqual({ processed: 1, done: 1, failed: 0 });
    expect(jobUpdate(admin)).toMatchObject({ status: "done", result: { text: "Ich bin dafür." }, error: null });
    expect(admin.bucket.remove).toHaveBeenCalledWith([path]);
  });

  it("claims exactly one job when a job id is given", async () => {
    const admin = setAdmin(fakeClient({ rpc: { claim_jobs: [{ data: [] }] } }));
    await runTranscribeJobs({ jobId: JOB });
    expect(argsOf(admin, "rpc:claim_jobs", "rpc")).toEqual([{ p_kind: "transcribe", p_limit: 1, p_job_id: JOB }]);
  });

  it("throws when jobs cannot be claimed", async () => {
    setAdmin(fakeClient({ rpc: { claim_jobs: [{ error: { message: "kaputt" } }] } }));
    await expect(runTranscribeJobs()).rejects.toMatchObject({ message: "kaputt" });
  });

  it("fails with a clear message when the recording is missing", async () => {
    const admin = setAdmin(fakeClient({ rpc: { claim_jobs: [{ data: [voiceJob()] }] } }));
    admin.bucket.download.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    expect(await runTranscribeJobs()).toEqual({ processed: 1, done: 0, failed: 1 });
    expect(jobUpdate(admin)).toMatchObject({ status: "failed", error: expect.stringContaining("nicht gefunden") });
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("deletes silent recordings and asks for a new one", async () => {
    const admin = setAdmin(fakeClient({ rpc: { claim_jobs: [{ data: [voiceJob()] }] } }));
    vi.mocked(transcribe).mockResolvedValueOnce({ text: "", provider: "groq", model: "whisper", ms: 100 });
    await runTranscribeJobs();
    expect(jobUpdate(admin).error).toContain("keine Sprache");
    expect(admin.bucket.remove).toHaveBeenCalledWith([path]);
  });

  it("keeps the audio for a retry while the service is busy", async () => {
    const admin = setAdmin(fakeClient({ rpc: { claim_jobs: [{ data: [voiceJob(1)] }] } }));
    vi.mocked(transcribe).mockRejectedValueOnce(new SttError("groq 429", true));
    await runTranscribeJobs();
    expect(jobUpdate(admin).error).toContain("gleich noch einmal");
    expect(admin.bucket.remove).not.toHaveBeenCalled();
  });

  it("deletes the audio after the last attempt", async () => {
    const admin = setAdmin(fakeClient({ rpc: { claim_jobs: [{ data: [voiceJob(3)] }] } }));
    vi.mocked(transcribe).mockRejectedValueOnce(new SttError("groq 503", true));
    await runTranscribeJobs();
    expect(jobUpdate(admin).error).toContain("als Text");
    expect(admin.bucket.remove).toHaveBeenCalledWith([path]);
  });

  it("deletes the audio at once when the error would repeat", async () => {
    const admin = setAdmin(fakeClient({ rpc: { claim_jobs: [{ data: [voiceJob(1)] }] } }));
    vi.mocked(transcribe).mockRejectedValueOnce(new SttError("groq 400", false));
    await runTranscribeJobs();
    expect(jobUpdate(admin).error).toContain("neu auf");
    expect(admin.bucket.remove).toHaveBeenCalledWith([path]);
  });
});

describe("sweepOldAudio", () => {
  it("removes recordings older than 24 hours and keeps newer ones", async () => {
    const now = Date.parse("2026-11-17T12:00:00Z");
    const admin = setAdmin(fakeClient());
    admin.bucket.list.mockImplementation(async (prefix: string) =>
      prefix === ""
        ? { data: [{ name: USER }] }
        : {
            data: [
              { name: "alt.webm", created_at: "2026-11-16T11:59:00Z" },
              { name: "neu.webm", created_at: "2026-11-17T11:00:00Z" },
              { name: "ohne-datum.webm" },
            ],
          },
    );
    expect(await sweepOldAudio(now)).toBe(1);
    expect(admin.bucket.remove).toHaveBeenCalledWith([`${USER}/alt.webm`]);
  });

  it("does nothing when there is nothing old", async () => {
    const admin = setAdmin(fakeClient());
    expect(await sweepOldAudio()).toBe(0);
    expect(admin.bucket.remove).not.toHaveBeenCalled();
  });
});

describe("runAnalyzeJobs", () => {
  const analyzeJob = (attempts = 1) => ({ id: JOB, round_id: ROUND, attempts });
  const withRound = (attempts = 1, responses: unknown = [{ pseudonym: "A01", body: "Ja" }, { pseudonym: "A02", body: "Nein" }]) =>
    setAdmin(
      fakeClient({
        rpc: { claim_jobs: [{ data: [analyzeJob(attempts)] }] },
        tables: { rounds: [{ data: { question: "Hotline testen?", context: null } }], responses: [{ data: responses }] },
      }),
    );
  const mapResult = {
    map: { clusters: [{ title: "Dafür", kind: "consensus", summary: "S", source_ids: ["A01"] }], open_questions: [] },
    provider: "gemini",
    model: "gemini-3.5-flash",
    promptVersion: "v1",
    ms: 1200,
    responseCount: 2,
    coveredByModel: 1,
  };

  it("sends only pseudonyms and texts to AsyncMeet and stores the map", async () => {
    const admin = withRound();
    vi.mocked(buildPerspectiveMap).mockResolvedValueOnce(mapResult as never);

    expect(await runAnalyzeJobs()).toEqual({ processed: 1, done: 1, failed: 0 });
    expect(argsOf(admin, "responses", "select")).toEqual(["pseudonym, body"]);
    expect(buildPerspectiveMap).toHaveBeenCalledWith({
      question: "Hotline testen?",
      context: null,
      responses: [
        { id: "A01", text: "Ja" },
        { id: "A02", text: "Nein" },
      ],
    });
    expect(argsOf(admin, "analyses", "upsert")).toEqual([
      expect.objectContaining({ round_id: ROUND, job_id: JOB, prompt_version: "v1", response_count: 2, covered_count: 1 }),
      { onConflict: "round_id" },
    ]);
    expect(jobUpdate(admin).status).toBe("done");
  });

  it("does not call the model for a round without answers", async () => {
    const admin = withRound(1, []);
    expect(await runAnalyzeJobs()).toEqual({ processed: 1, done: 0, failed: 1 });
    expect(buildPerspectiveMap).not.toHaveBeenCalled();
    expect(jobUpdate(admin).error).toContain("keine Antworten");
  });

  it("offers a retry while the model is busy", async () => {
    const admin = withRound(1);
    vi.mocked(buildPerspectiveMap).mockRejectedValueOnce(new LlmError("gemini 429", true));
    await runAnalyzeJobs();
    expect(jobUpdate(admin).error).toContain("gleich noch einmal");
  });

  it("points to the original answers after the last attempt", async () => {
    const admin = withRound(3);
    vi.mocked(buildPerspectiveMap).mockRejectedValueOnce(new LlmError("gemini 503", true));
    await runAnalyzeJobs();
    expect(jobUpdate(admin).error).toContain("im Original");
  });

  it("gives up at once on errors that would repeat", async () => {
    const admin = withRound(1);
    vi.mocked(buildPerspectiveMap).mockRejectedValueOnce(new LlmError("gemini 400", false));
    await runAnalyzeJobs();
    expect(jobUpdate(admin).error).toContain("im Original");
  });

  it("treats a failed save like a temporary error", async () => {
    const admin = setAdmin(
      fakeClient({
        rpc: { claim_jobs: [{ data: [analyzeJob(1)] }] },
        tables: {
          rounds: [{ data: { question: "Q?", context: null } }],
          responses: [{ data: [{ pseudonym: "A01", body: "Ja" }] }],
          analyses: [{ error: { message: "db down" } }],
        },
      }),
    );
    vi.mocked(buildPerspectiveMap).mockResolvedValueOnce(mapResult as never);
    expect(await runAnalyzeJobs()).toEqual({ processed: 1, done: 0, failed: 1 });
    expect(jobUpdate(admin).error).toContain("gleich noch einmal");
  });
});
