import { beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/db/admin";
import { signUp, testRun as run, type TestUser } from "./helpers";

/** Decisions and follow-up rounds (step 7) against staging. */
describe("decisions", () => {
  let lead: TestUser; // team lead
  let creator: TestUser; // member who starts the round
  let member: TestUser;
  let guest: TestUser;
  let outsider: TestUser;
  let teamId: string;
  let roundId: string;

  const hour = () => new Date(Date.now() + 3_600_000).toISOString();
  const newRound = async (by: TestUser, extra: { parent_round_id?: string; team_id?: string } = {}) =>
    by.client
      .from("rounds")
      .insert({ team_id: teamId, question: `Frage ${run}?`, deadline: hour(), ...extra })
      .select("id")
      .single();
  const decide = (by: TestUser, id = roundId) =>
    by.client.rpc("decide_round", {
      p_round_id: id,
      p_body: "Wir testen vier Wochen.",
      p_rationale: "Mehrheit dafür, Bedenken zur Hotline werden geklärt.",
      p_cluster_refs: [0, 2],
    });

  beforeAll(async () => {
    [lead, creator, member, guest, outsider] = await Promise.all([
      signUp("d-lead"),
      signUp("d-creator"),
      signUp("d-member"),
      signUp("d-guest"),
      signUp("d-out"),
    ]);
    const orgId = (await lead.client.rpc("create_organization", { p_name: `Beschluss ${run}` })).data!.id;
    const admin = createAdminClient();
    await admin.from("organization_members").insert([
      { organization_id: orgId, user_id: creator.userId, role: "member" },
      { organization_id: orgId, user_id: member.userId, role: "member" },
      { organization_id: orgId, user_id: guest.userId, role: "guest" },
    ]);
    teamId = (await lead.client.rpc("create_team", { p_name: `Team ${run}`, p_organization_id: orgId })).data!.id;
    for (const u of [creator, member, guest])
      await lead.client.rpc("add_team_member", { p_team_id: teamId, p_user_id: u.userId });
    roundId = (await newRound(creator)).data!.id;
    await member.client.from("responses").insert({ round_id: roundId, body: "Dafür" });
  });

  it("cannot decide while the round is open", async () => {
    expect((await decide(creator)).error?.hint).toBe("round_open");
  });

  it("nobody sets 'decided' directly, without a decision", async () => {
    await creator.client.from("rounds").update({ status: "closed" }).eq("id", roundId);
    const { error } = await creator.client.from("rounds").update({ status: "decided" }).eq("id", roundId);
    expect(error?.hint).toBe("decision_missing");
  });

  it("follow-up rounds need a closed origin in the same team", async () => {
    const open = (await newRound(creator)).data!.id;
    expect((await newRound(creator, { parent_round_id: open })).error?.hint).toBe("parent_open");

    const otherTeam = (await outsider.client.rpc("create_team", { p_name: `Fremd ${run}` })).data!.id;
    const foreign = await outsider.client
      .from("rounds")
      .insert({ team_id: otherTeam, question: "Fremd?", deadline: hour(), parent_round_id: roundId })
      .select("id")
      .single();
    expect(foreign.error?.hint).toBe("invalid_parent");

    const followUp = await newRound(member, { parent_round_id: roundId });
    expect(followUp.error).toBeNull();
    const { data } = await lead.client.from("rounds").select("parent_round_id").eq("id", followUp.data!.id).single();
    expect(data?.parent_round_id).toBe(roundId);
  });

  it("only the round creator or the team lead decides, never members, guests or outsiders", async () => {
    expect((await decide(member)).error?.code).toBe("42501");
    expect((await decide(guest)).error?.code).toBe("42501");
    expect((await decide(outsider)).error?.code).toBe("P0002");
  });

  it("deciding stores the decision and sets the round to decided, once", async () => {
    const { data, error } = await decide(creator);
    expect(error).toBeNull();
    expect(data).toMatchObject({ round_id: roundId, team_id: teamId, cluster_refs: [0, 2], decided_by: creator.userId });
    const { data: round } = await member.client.from("rounds").select("status").eq("id", roundId).single();
    expect(round?.status).toBe("decided");
    expect((await decide(lead)).error?.hint).toBe("already_decided");
  });

  it("everyone in the team sees the decision, outsiders do not", async () => {
    for (const u of [lead, member, guest]) {
      expect((await u.client.from("decisions").select("id").eq("round_id", roundId)).data).toHaveLength(1);
    }
    expect((await outsider.client.from("decisions").select("id").eq("round_id", roundId)).data).toEqual([]);
  });

  it("decisions cannot be changed or deleted by anyone", async () => {
    const id = (await lead.client.from("decisions").select("id").eq("round_id", roundId).single()).data!.id;
    await creator.client.from("decisions").update({ body: "Doch nicht" }).eq("id", id);
    await lead.client.from("decisions").delete().eq("id", id);
    const { data } = await member.client.from("decisions").select("body").eq("id", id).single();
    expect(data?.body).toBe("Wir testen vier Wochen.");
    const insert = await lead.client
      .from("decisions")
      .insert({ round_id: roundId, team_id: teamId, body: "Gefälscht", rationale: "Ohne Runde" });
    expect(insert.error).not.toBeNull();
  });

  it("read receipts: only your own, counted without names", async () => {
    const id = (await lead.client.from("decisions").select("id").eq("round_id", roundId).single()).data!.id;
    const count = async () => (await lead.client.rpc("decision_read_count", { p_decision_id: id })).data![0];
    expect(await count()).toEqual({ read_count: 1, member_count: 4 }); // the decider has read it

    expect((await member.client.from("decision_reads").insert({ decision_id: id, user_id: member.userId })).error).toBeNull();
    expect((await member.client.from("decision_reads").insert({ decision_id: id, user_id: guest.userId })).error).not.toBeNull();
    expect(
      (await outsider.client.from("decision_reads").insert({ decision_id: id, user_id: outsider.userId })).error,
    ).not.toBeNull();
    expect(await count()).toEqual({ read_count: 2, member_count: 4 });

    // Nobody sees who else has (not) read.
    const { data } = await lead.client.from("decision_reads").select("user_id").eq("decision_id", id);
    expect(data).toEqual([]);
    expect((await outsider.client.rpc("decision_read_count", { p_decision_id: id })).data).toEqual([]);
  });
});
