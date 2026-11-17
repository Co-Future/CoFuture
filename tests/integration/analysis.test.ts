import { beforeAll, describe, expect, it } from "vitest";
import type { PerspectiveMapData } from "@/lib/ai/schema";
import { runAnalyzeJobs } from "@/lib/jobs/analyze";
import { signUp, testRun as run, type TestUser } from "./helpers";

// Made-up answers only (free AI tiers). Groq first, to save the Gemini quota.
process.env.LLM_PROVIDER = "groq";

const answers = [
  "Ich bin für die Vier-Tage-Woche, dann habe ich mehr Zeit für meine Familie.",
  "Finde ich gut, mehr Erholung heißt weniger Fehler.",
  "Ja, aber nur wenn die Kundenhotline weiter von Montag bis Freitag erreichbar ist.",
  "Bin dagegen. Zehn Stunden am Tag schaffe ich mit meinen Kindern nicht.",
  "Als Teilzeitkraft habe ich davon gar nichts. Bitte denkt auch an uns.",
];

/** Closing a round queues the analysis; the worker builds a map that covers every answer. */
describe("perspective map", () => {
  let users: TestUser[];
  let outsider: TestUser;
  let roundId: string;

  beforeAll(async () => {
    users = await Promise.all(answers.map((_, i) => signUp(`a${i}`)));
    outsider = await signUp("a-out");
    const [lead, ...members] = users;
    const teamId = (
      await lead.client.rpc("create_team", { p_name: `Analyse ${run}` })
    ).data!.id;
    for (const m of members)
      await lead.client.rpc("add_team_member_by_email", {
        p_team_id: teamId,
        p_email: m.email,
      });
    const round = await lead.client
      .from("rounds")
      .insert({
        team_id: teamId,
        question: "Sollen wir die Vier-Tage-Woche testen?",
        deadline: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .select("id")
      .single();
    roundId = round.data!.id;
    for (const [i, u] of users.entries()) {
      const { error } = await u.client
        .from("responses")
        .insert({ round_id: roundId, body: answers[i] });
      if (error) throw error;
    }
  });

  it("does not queue an analysis while the round is open", async () => {
    const { data } = await users[0].client
      .from("analysis_jobs")
      .select("id")
      .eq("round_id", roundId)
      .eq("kind", "analyze");
    expect(data).toEqual([]);
  });

  it("closing queues one job, the worker builds the map and every member sees it", async () => {
    await users[0].client
      .from("rounds")
      .update({ status: "closed" })
      .eq("id", roundId);
    const { data: jobs } = await users[3].client
      .from("analysis_jobs")
      .select("id, status")
      .eq("round_id", roundId)
      .eq("kind", "analyze");
    expect(jobs).toHaveLength(1);
    expect(jobs![0].status).toBe("pending");

    expect(await runAnalyzeJobs({ jobId: jobs![0].id })).toEqual({
      processed: 1,
      done: 1,
      failed: 0,
    });

    const { data: analysis } = await users[4].client
      .from("analyses")
      .select("*")
      .eq("round_id", roundId)
      .single();
    expect(analysis).not.toBeNull();
    expect(analysis!.prompt_version).toBe("v1");
    expect(analysis!.response_count).toBe(5);

    const { data: own } = await users[0].client
      .from("round_responses")
      .select("pseudonym")
      .eq("round_id", roundId);
    const ids = new Set(own!.map((r) => r.pseudonym));
    const map = analysis!.map as PerspectiveMapData;
    expect(map.clusters.length).toBeGreaterThan(0);
    for (const c of map.clusters) {
      expect(c.source_ids.length).toBeGreaterThan(0);
      for (const id of c.source_ids) expect(ids.has(id)).toBe(true);
    }
    expect(new Set(map.clusters.flatMap((c) => c.source_ids))).toEqual(ids);

    // The outsider sees neither the map nor the job.
    const foreign = await outsider.client
      .from("analyses")
      .select("id")
      .eq("round_id", roundId);
    expect(foreign.data).toEqual([]);
  }, 120_000);

  it("closing again does not queue a second job", async () => {
    await users[0].client
      .from("rounds")
      .update({ status: "closed" })
      .eq("id", roundId);
    const { data } = await users[0].client
      .from("analysis_jobs")
      .select("id")
      .eq("round_id", roundId)
      .eq("kind", "analyze");
    expect(data).toHaveLength(1);
  });
});
