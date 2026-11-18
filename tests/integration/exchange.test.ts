import { beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/db/admin";
import { signUp, testRun as run, type TestUser } from "./helpers";

/** Exchanges with several questions, targets, answers per question and follow-up questions (ADR 012). */
describe("exchange", () => {
  let lead: TestUser;
  let tom: TestUser;
  let lars: TestUser;
  let guest: TestUser;
  let outsider: TestUser;
  let teamId: string;
  let roundId: string;
  let qAll: string;
  let qTom: string;

  const start = (by: TestUser, questions: unknown, deadline?: string) =>
    by.client.rpc("create_exchange", { p_team_id: teamId, p_questions: questions as never, p_deadline: deadline });
  const save = (by: TestUser, answers: { question_id: string; body: string }[]) =>
    by.client.rpc("save_answers", { p_round_id: roundId, p_answers: answers });

  beforeAll(async () => {
    [lead, tom, lars, guest, outsider] = await Promise.all([
      signUp("x-lead"),
      signUp("x-tom"),
      signUp("x-lars"),
      signUp("x-guest"),
      signUp("x-out"),
    ]);
    const orgId = (await lead.client.rpc("create_organization", { p_name: `Austausch ${run}` })).data!.id;
    await createAdminClient()
      .from("organization_members")
      .insert([
        { organization_id: orgId, user_id: tom.userId, role: "member" },
        { organization_id: orgId, user_id: lars.userId, role: "member" },
        { organization_id: orgId, user_id: guest.userId, role: "guest" },
      ]);
    teamId = (await lead.client.rpc("create_team", { p_name: `Team ${run}`, p_organization_id: orgId })).data!.id;
    for (const u of [tom, lars, guest]) await lead.client.rpc("add_team_member", { p_team_id: teamId, p_user_id: u.userId });

    roundId = (await start(lead, [{ body: "Passt der Termin für alle?" }, { body: "Tom, übernimmst du den Support?", targets: [tom.userId] }])).data!;
    const { data: qs } = await lead.client.from("round_questions").select("id, position").eq("round_id", roundId).order("position");
    [qAll, qTom] = qs!.map((q) => q.id);
  });

  it("starts with all questions and targets in one step, without a deadline", async () => {
    const { data: round } = await lead.client.from("rounds").select("question, deadline").eq("id", roundId).single();
    expect(round).toEqual({ question: "Passt der Termin für alle?", deadline: null });
    const { data: targets } = await lars.client.from("round_question_targets").select("question_id, user_id");
    expect(targets).toEqual([{ question_id: qTom, user_id: tom.userId }]);
  });

  it("guests and outsiders cannot start, targets must be in the team", async () => {
    expect((await start(guest, [{ body: "Gast fragt?" }])).error?.code).toBe("42501");
    expect((await start(outsider, [{ body: "Fremd?" }])).error?.code).toBe("42501");
    expect((await start(lead, [{ body: "An Fremde?", targets: [outsider.userId] }])).error?.hint).toBe("invalid_target");
  });

  it("only the addressed person answers a targeted question", async () => {
    expect((await save(lars, [{ question_id: qTom, body: "Ich nicht." }])).error?.hint).toBe("invalid_question");
    expect((await save(tom, [{ question_id: qAll, body: "Ja." }, { question_id: qTom, body: "Mach ich." }])).data).toBe("A01");
    expect((await save(guest, [{ question_id: qAll, body: "Passt." }])).data).toBe("A02");
  });

  it("answers stay private while open, except your own", async () => {
    const { data: larsSees } = await lars.client.from("round_answers").select("body").eq("round_id", roundId);
    expect(larsSees).toEqual([]);
    const { data: tomSees } = await tom.client.from("round_answers").select("body, is_own").eq("round_id", roundId);
    expect(tomSees).toHaveLength(2);
  });

  it("an empty answer removes it; no answers removes the response", async () => {
    await save(guest, [{ question_id: qAll, body: "  " }]);
    const { data: count } = await lead.client.rpc("round_response_count", { p_round_id: roundId });
    expect(count).toBe(1);
  });

  it("follow-up questions show no author and only the starter or lead answers", async () => {
    const { data: c } = await lars.client
      .from("round_clarifications")
      .insert({ round_id: roundId, question_id: qAll, body: "Welcher Termin genau?" })
      .select("id")
      .single();
    const { data: seen } = await tom.client.from("round_clarifications_public").select("*").eq("round_id", roundId);
    expect(seen![0]).toMatchObject({ body: "Welcher Termin genau?", is_own: false });
    expect(Object.keys(seen![0])).not.toContain("author_id");
    expect((await tom.client.rpc("answer_clarification", { p_id: c!.id, p_answer: "Ich rate." })).error?.code).toBe("42501");
    expect((await lead.client.rpc("answer_clarification", { p_id: c!.id, p_answer: "Freitag, 10:00 Uhr." })).error).toBeNull();
  });

  it("after closing everyone sees all answers with pseudonyms, nobody can change them", async () => {
    await lead.client.from("rounds").update({ status: "closed" }).eq("id", roundId);
    const { data } = await lars.client.from("round_answers").select("question_id, pseudonym, body").eq("round_id", roundId).order("question_id");
    expect(data).toHaveLength(2);
    expect(new Set(data!.map((a) => a.pseudonym))).toEqual(new Set(["A01"]));
    expect((await save(tom, [{ question_id: qAll, body: "Später." }])).error?.hint).toBe("round_closed");
  });
});
