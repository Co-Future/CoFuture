import { beforeAll, describe, expect, it } from "vitest";
import { proposeDecision, splitDictatedDecision } from "@/lib/ai/decision";
import { createAdminClient } from "@/lib/db/admin";
import { loadDecisionContext } from "@/lib/decisions/context";
import { answer, setUpTeam, signUp, startExchange, type TestUser } from "./helpers";

// Made-up texts only (free AI tiers). Groq first, to save the Gemini quota.
process.env.LLM_PROVIDER = "groq";

/** Decision proposals and dictation (roadmap 7c) against staging. */
describe("decision proposals", () => {
  const admin = createAdminClient();
  let lead: TestUser;
  let member: TestUser;
  let guest: TestUser;
  let roundId: string;
  let questionId: string;

  const voiceJob = (u: TestUser, id = roundId) =>
    u.client.from("analysis_jobs").insert({
      kind: "transcribe",
      round_id: id,
      payload: { path: `${u.userId}/${crypto.randomUUID()}.webm`, mime: "audio/webm", durationMs: 1000, purpose: "decision" },
    });

  beforeAll(async () => {
    [lead, member, guest] = await Promise.all([signUp("p-lead"), signUp("p-member"), signUp("p-guest")]);
    const { teamId } = await setUpTeam(lead, [{ user: member }, { user: guest, role: "guest" }], "Vorschlag");
    ({
      roundId,
      questionIds: [questionId],
    } = await startExchange(lead, teamId, ["Sollen wir die Vier-Tage-Woche testen?"]));
    await answer(member, roundId, questionId, "Ja, wenn die Hotline besetzt bleibt.");
    await answer(guest, roundId, questionId, "Ja, mehr Erholung.");
    await answer(lead, roundId, questionId, "Ich bin dafür, ab März.");
    await lead.client.from("rounds").update({ status: "closed" }).eq("id", roundId);
    const { error } = await admin.from("analyses").upsert(
      {
        round_id: roundId,
        provider: "test",
        model: "test",
        prompt_version: "test",
        response_count: 3,
        covered_count: 3,
        duration_ms: 1,
        map: {
          clusters: [
            {
              title: "Grundsätzlich dafür",
              kind: "consensus",
              summary: "Alle sind für einen Test, einer nennt März als Start.",
              source_ids: ["A01", "A02", "A03"],
              question_id: questionId,
            },
            {
              title: "Hotline besetzt halten",
              kind: "single_voice",
              summary: "Die Kundenhotline muss an allen Werktagen besetzt bleiben.",
              source_ids: ["A02"],
              question_id: questionId,
            },
          ],
          open_questions: [],
          overviews: [
            {
              text: "Alle sind für einen Test ab März, die Hotline muss besetzt bleiben.",
              source_ids: ["A01", "A02", "A03"],
              question_id: questionId,
            },
          ],
        } as never,
      },
      { onConflict: "round_id" },
    );
    if (error) throw error;
  });

  it("only the creator or team lead gets a decision context, never members or guests", async () => {
    expect(await loadDecisionContext(member.client, roundId, member.userId)).toMatchObject({ ok: false, status: 403 });
    expect(await loadDecisionContext(guest.client, roundId, guest.userId)).toMatchObject({ ok: false, status: 403 });
    const ctx = await loadDecisionContext(lead.client, roundId, lead.userId);
    expect(ctx.ok).toBe(true);
    if (!ctx.ok) return;
    expect(ctx.groups.map((g) => [g.title, g.count, g.answered])).toEqual([
      ["Grundsätzlich dafür", 3, 3],
      ["Hotline besetzt halten", 1, 3],
    ]);
  });

  it("AsyncMeet proposes a decision that relies on the summary points", async () => {
    const ctx = await loadDecisionContext(lead.client, roundId, lead.userId);
    if (!ctx.ok) throw new Error(ctx.message);
    const { proposals } = await proposeDecision(ctx);
    expect(proposals.length).toBeGreaterThan(0);
    for (const p of proposals) {
      expect(p.body.length).toBeGreaterThan(3);
      expect(p.clusterRefs.length).toBeGreaterThan(0);
      for (const i of p.clusterRefs) expect([0, 1]).toContain(i);
    }
  }, 60_000);

  it("a dictated decision is split into decision and rationale", async () => {
    const d = await splitDictatedDecision(
      "Also, äh, wir machen das so: Wir testen die Vier-Tage-Woche von März bis Mai. Begründung ist, dass alle dafür sind und die Hotline über einen Dienstplan besetzt bleibt.",
    );
    expect(d.body).toMatch(/Vier-Tage-Woche/);
    expect(d.rationale).toMatch(/Hotline|dafür/);
  }, 60_000);

  it("only those who may decide can queue a dictated decision, and only before the decision", async () => {
    expect((await voiceJob(member)).error).not.toBeNull();
    expect((await voiceJob(guest)).error).not.toBeNull();
    expect((await voiceJob(lead)).error).toBeNull();
    await lead.client.rpc("decide_round", {
      p_round_id: roundId,
      p_body: "Wir testen ab März.",
      p_rationale: "Alle dafür.",
      p_cluster_refs: [0],
    });
    expect((await voiceJob(lead)).error).not.toBeNull();
    expect(await loadDecisionContext(lead.client, roundId, lead.userId)).toMatchObject({ ok: false, code: "already_decided" });
  });
});
