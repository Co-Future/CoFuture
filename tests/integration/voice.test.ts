import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/db/admin";
import { runTranscribeJobs } from "@/lib/jobs/transcribe";
import { setUpTeam, signUp, startExchange, type TestUser } from "./helpers";

/** Voice upload rules and the transcription worker, against staging and the real Groq API. */
describe("voice answers", () => {
  let lead: TestUser;
  let outsider: TestUser;
  let roundId: string;
  const audio = readFileSync("tests/fixtures/answer-de.ogg");

  beforeAll(async () => {
    [lead, outsider] = await Promise.all([signUp("v-lead"), signUp("v-out")]);
    const { teamId } = await setUpTeam(lead, [], "Voice");
    ({ roundId } = await startExchange(lead, teamId, ["Wie findest du die Vier-Tage-Woche?"], { deadlineMs: 3_600_000 }));
  });

  const upload = (user: TestUser, folder: string) =>
    user.client.storage.from("voice").upload(`${folder}/${crypto.randomUUID()}.ogg`, audio, { contentType: "audio/ogg" });

  it("uploads only into your own folder, and nobody can read audio back", async () => {
    const own = await upload(lead, lead.userId);
    expect(own.error).toBeNull();
    const foreign = await upload(outsider, lead.userId);
    expect(foreign.error).not.toBeNull();
    const read = await lead.client.storage.from("voice").download(own.data!.path);
    expect(read.data).toBeNull();
  });

  it("queues jobs only for your own file in an open round of your team", async () => {
    const path = `${lead.userId}/${crypto.randomUUID()}.ogg`;
    const foreignPath = await outsider.client
      .from("analysis_jobs")
      .insert({ kind: "transcribe", round_id: roundId, payload: { path, mime: "audio/ogg" } });
    expect(foreignPath.error).not.toBeNull();
    const outsiderOwn = await outsider.client
      .from("analysis_jobs")
      .insert({ kind: "transcribe", round_id: roundId, payload: { path: `${outsider.userId}/x.ogg`, mime: "audio/ogg" } });
    expect(outsiderOwn.error).not.toBeNull();
  });

  it("users cannot change jobs or claim them", async () => {
    const claim = await lead.client.rpc("claim_jobs", { p_kind: "transcribe" });
    expect(claim.error).not.toBeNull();
  });

  it("the worker transcribes, stores the text in the job and deletes the audio", async () => {
    const uploaded = await upload(lead, lead.userId);
    const path = uploaded.data!.path;
    const job = await lead.client
      .from("analysis_jobs")
      .insert({ kind: "transcribe", round_id: roundId, payload: { path, mime: "audio/ogg", durationMs: 12_000 } })
      .select("id")
      .single();
    expect(job.error).toBeNull();

    const result = await runTranscribeJobs({ jobId: job.data!.id });
    expect(result).toEqual({ processed: 1, done: 1, failed: 0 });

    const done = await lead.client.from("analysis_jobs").select("status, result").eq("id", job.data!.id).single();
    expect(done.data?.status).toBe("done");
    const transcript = done.data?.result as { text: string; provider: string };
    expect(transcript.text.toLowerCase()).toMatch(/vier.?tage.?woche/);
    expect(transcript.provider).toBe("groq");

    const leftover = await createAdminClient().storage.from("voice").download(path);
    expect(leftover.data).toBeNull();

    // Claiming the same job again does nothing: it is done.
    expect(await runTranscribeJobs({ jobId: job.data!.id })).toEqual({ processed: 0, done: 0, failed: 0 });
  }, 60_000);

  it("a missing file fails the job with a clear message", async () => {
    const job = await lead.client
      .from("analysis_jobs")
      .insert({
        kind: "transcribe",
        round_id: roundId,
        payload: { path: `${lead.userId}/${crypto.randomUUID()}.ogg`, mime: "audio/ogg" },
      })
      .select("id")
      .single();
    expect(await runTranscribeJobs({ jobId: job.data!.id })).toEqual({ processed: 1, done: 0, failed: 1 });
    const failed = await lead.client.from("analysis_jobs").select("status, error").eq("id", job.data!.id).single();
    expect(failed.data).toEqual({ status: "failed", error: "Die Aufnahme wurde nicht gefunden. Nimm sie bitte neu auf." });
  });
});
