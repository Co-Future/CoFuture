import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { env, signUp, testRun as run } from "./helpers";

/**
 * Checks the access rules from the initial migration against a real Supabase project.
 * Needs: migration applied, sign-up enabled, email confirmation switched off.
 */

describe("row level security", () => {
  let lead: Awaited<ReturnType<typeof signUp>>;
  let member: Awaited<ReturnType<typeof signUp>>;
  let outsider: Awaited<ReturnType<typeof signUp>>;
  let teamId: string;
  let roundId: string;

  beforeAll(async () => {
    [lead, member, outsider] = await Promise.all([signUp("lead"), signUp("member"), signUp("outsider")]);

    const team = await lead.client.rpc("create_team", { p_name: `Testteam ${run}` });
    expect(team.error).toBeNull();
    teamId = team.data!.id;

    const added = await lead.client.from("team_members").insert({ team_id: teamId, user_id: member.userId });
    expect(added.error).toBeNull();

    const round = await lead.client
      .from("rounds")
      .insert({ team_id: teamId, question: "Testfrage?", deadline: new Date(Date.now() + 3_600_000).toISOString() })
      .select("id")
      .single();
    expect(round.error).toBeNull();
    roundId = round.data!.id;
  });

  it("anonymous visitors see nothing", async () => {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data } = await anon.from("teams").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("the creator is lead, and outsiders cannot see the team or its rounds", async () => {
    const role = await lead.client.from("team_members").select("role").eq("user_id", lead.userId).single();
    expect(role.data?.role).toBe("lead");

    expect((await outsider.client.from("teams").select("id").eq("id", teamId)).data).toHaveLength(0);
    expect((await outsider.client.from("rounds").select("id").eq("id", roundId)).data).toHaveLength(0);
  });

  it("outsiders cannot answer, members get pseudonyms in order", async () => {
    const blocked = await outsider.client.from("responses").insert({ round_id: roundId, body: "Darf ich?" });
    expect(blocked.error).not.toBeNull();

    const first = await lead.client.from("responses").insert({ round_id: roundId, body: "Ja" }).select().single();
    const second = await member.client.from("responses").insert({ round_id: roundId, body: "Nein" }).select().single();
    expect(first.data?.pseudonym).toBe("A01");
    expect(second.data?.pseudonym).toBe("A02");
  });

  it("while the round is open, members only see their own answer", async () => {
    const { data } = await member.client.from("round_responses").select("pseudonym, is_own").eq("round_id", roundId);
    expect(data).toEqual([{ pseudonym: "A02", is_own: true }]);
  });

  it("members cannot promote themselves to lead", async () => {
    await member.client.from("team_members").update({ role: "lead" }).eq("user_id", member.userId);
    const role = await lead.client.from("team_members").select("role").eq("user_id", member.userId).single();
    expect(role.data?.role).toBe("member");
  });

  it("after closing, everyone sees all answers without author ids", async () => {
    const closed = await lead.client.from("rounds").update({ status: "closed" }).eq("id", roundId);
    expect(closed.error).toBeNull();

    const { data } = await member.client.from("round_responses").select("*").eq("round_id", roundId).order("pseudonym");
    expect(data?.map((r) => r.pseudonym)).toEqual(["A01", "A02"]);
    expect(Object.keys(data![0])).not.toContain("author_id");
    expect(data![0].display_name).toBeNull();

    // The base table stays private to the author.
    const base = await member.client.from("responses").select("id").eq("round_id", roundId);
    expect(base.data).toHaveLength(1);
  });

  it("answers cannot be changed after the round is closed", async () => {
    await member.client.from("responses").update({ body: "Doch ja" }).eq("round_id", roundId);
    const own = await member.client.from("responses").select("body").eq("round_id", roundId).single();
    expect(own.data?.body).toBe("Nein");
  });
});
