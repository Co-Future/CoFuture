import { beforeAll, describe, expect, it } from "vitest";
import { answer, setUpTeam, signUp, startExchange, type TestUser } from "./helpers";

const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

/** Round lifecycle rules from the rounds_lifecycle migration. */
describe("round lifecycle", () => {
  let lead: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let teamId: string;

  beforeAll(async () => {
    [lead, member, outsider] = await Promise.all([signUp("r-lead"), signUp("r-member"), signUp("r-out")]);
    ({ teamId } = await setUpTeam(lead, [{ user: member }], "Runden"));
  });

  const questionOf = new Map<string, string>();
  async function newRound(by: TestUser, deadlineMs = 3_600_000) {
    const { roundId, questionIds } = await startExchange(by, teamId, ["Passt der Termin am Donnerstag?"], { deadlineMs });
    questionOf.set(roundId, questionIds[0]);
    return roundId;
  }
  const reply = (by: TestUser, roundId: string, body: string) => answer(by, roundId, questionOf.get(roundId)!, body);

  it("members can start rounds, outsiders cannot", async () => {
    await expect(newRound(member)).resolves.toBeTypeOf("string");
    const blocked = await outsider.client.rpc("create_exchange", {
      p_team_id: teamId,
      p_questions: [{ body: "Hallo zusammen?" }] as never,
    });
    expect(blocked.error).not.toBeNull();
    const direct = await outsider.client
      .from("rounds")
      .insert({ team_id: teamId, question: "Hallo zusammen?", deadline: inMs(3_600_000) });
    expect(direct.error).not.toBeNull();
  });

  it("the answer count is visible to members while open, never who answered", async () => {
    const roundId = await newRound(lead);
    await reply(lead, roundId, "Ja");
    await reply(member, roundId, "Nein");
    expect((await member.client.rpc("round_response_count", { p_round_id: roundId })).data).toBe(2);
    expect((await outsider.client.rpc("round_response_count", { p_round_id: roundId })).data).toBe(0);
  });

  it("the question freezes after the first answer", async () => {
    const roundId = await newRound(member);
    expect((await member.client.from("rounds").update({ question: "Neue Frage?" }).eq("id", roundId)).error).toBeNull();
    await reply(member, roundId, "Antwort");
    const frozen = await member.client.from("rounds").update({ question: "Noch eine?" }).eq("id", roundId);
    expect(frozen.error?.hint).toBe("question_frozen");
  });

  it("deadlines move only into the future", async () => {
    const roundId = await newRound(lead);
    expect(
      (
        await lead.client
          .from("rounds")
          .update({ deadline: inMs(7_200_000) })
          .eq("id", roundId)
      ).error,
    ).toBeNull();
    const past = await lead.client
      .from("rounds")
      .update({ deadline: inMs(-60_000) })
      .eq("id", roundId);
    expect(past.error?.hint).toBe("invalid_deadline");
  });

  it("closing sets closed_at, and a closed round cannot reopen", async () => {
    const roundId = await newRound(lead);
    await lead.client.from("rounds").update({ status: "closed" }).eq("id", roundId);
    const { data } = await lead.client.from("rounds").select("status, closed_at").eq("id", roundId).single();
    expect(data?.status).toBe("closed");
    expect(data?.closed_at).not.toBeNull();
    const reopen = await lead.client.from("rounds").update({ status: "open" }).eq("id", roundId);
    expect(reopen.error?.hint).toBe("invalid_status");
  });

  it("plain members cannot close someone else's round", async () => {
    const roundId = await newRound(lead);
    const { data } = await member.client.from("rounds").update({ status: "closed" }).eq("id", roundId).select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("users cannot trigger the closing job themselves", async () => {
    const { error } = await lead.client.rpc("close_expired_rounds");
    expect(error).not.toBeNull();
  });

  it("pg_cron closes a round after its deadline and reveals all answers", async () => {
    const roundId = await newRound(lead, 8_000);
    await reply(member, roundId, "Kurz vor knapp");

    let status = "open";
    for (let i = 0; i < 20 && status === "open"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      status = (await lead.client.from("rounds").select("status").eq("id", roundId).single()).data!.status;
    }
    expect(status).toBe("closed");
    const { data } = await lead.client.from("round_responses").select("pseudonym, is_own").eq("round_id", roundId);
    expect(data).toEqual([{ pseudonym: "A01", is_own: false }]);
  }, 120_000);
});
