import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { answer, env, setUpTeam, signUp, startExchange, type TestUser } from "./helpers";

/**
 * Basic access rules against a real Supabase project: teams, exchanges, answers, pseudonyms.
 * Needs: migrations applied, sign-up enabled, email confirmation switched off.
 */
describe("row level security", () => {
  let lead: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let teamId: string;
  let roundId: string;
  let questionId: string;

  beforeAll(async () => {
    [lead, member, outsider] = await Promise.all([signUp("lead"), signUp("member"), signUp("outsider")]);
    ({ teamId } = await setUpTeam(lead, [{ user: member }], "Testteam"));
    ({
      roundId,
      questionIds: [questionId],
    } = await startExchange(lead, teamId, ["Passt der Termin am Donnerstag?"], { deadlineMs: 3_600_000 }));
  });

  it("anonymous visitors see nothing", async () => {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data } = await anon.from("teams").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("the creator is lead, and outsiders cannot see the team or its exchanges", async () => {
    const role = await lead.client.from("team_members").select("role").eq("team_id", teamId).eq("user_id", lead.userId).single();
    expect(role.data?.role).toBe("lead");
    expect((await outsider.client.from("teams").select("id").eq("id", teamId)).data).toHaveLength(0);
    expect((await outsider.client.from("rounds").select("id").eq("id", roundId)).data).toHaveLength(0);
  });

  it("outsiders cannot answer, members get pseudonyms in order", async () => {
    expect((await answer(outsider, roundId, questionId, "Darf ich?")).error).not.toBeNull();
    expect((await answer(lead, roundId, questionId, "Ja")).error).toBeNull();
    expect((await answer(member, roundId, questionId, "Nein")).error).toBeNull();
    const own = async (u: TestUser) =>
      (await u.client.from("responses").select("pseudonym").eq("round_id", roundId).single()).data?.pseudonym;
    expect(await own(lead)).toBe("A01");
    expect(await own(member)).toBe("A02");
  });

  it("while the exchange is open, members only see their own answer", async () => {
    const { data } = await member.client.from("round_responses").select("pseudonym, is_own").eq("round_id", roundId);
    expect(data).toEqual([{ pseudonym: "A02", is_own: true }]);
  });

  it("members cannot promote themselves to lead", async () => {
    await member.client.from("team_members").update({ role: "lead" }).eq("team_id", teamId).eq("user_id", member.userId);
    const role = await lead.client
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", member.userId)
      .single();
    expect(role.data?.role).toBe("member");
  });

  it("after closing, everyone sees all answers without author ids", async () => {
    expect((await lead.client.from("rounds").update({ status: "closed" }).eq("id", roundId)).error).toBeNull();
    const { data } = await member.client.from("round_responses").select("*").eq("round_id", roundId).order("pseudonym");
    expect(data?.map((r) => r.pseudonym)).toEqual(["A01", "A02"]);
    expect(Object.keys(data![0])).not.toContain("author_id");
    // The base table stays private to the author.
    expect((await member.client.from("responses").select("id").eq("round_id", roundId)).data).toHaveLength(1);
  });

  it("answers cannot be changed after the exchange is closed", async () => {
    expect((await answer(member, roundId, questionId, "Doch ja")).error).not.toBeNull();
    await member.client.from("responses").update({ body: "Doch ja" }).eq("round_id", roundId);
    const own = await member.client.from("responses").select("body").eq("round_id", roundId).single();
    expect(own.data?.body).toContain("Nein");
    expect(own.data?.body).not.toContain("Doch ja");
  });
});
