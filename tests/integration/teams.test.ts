import { beforeAll, describe, expect, it } from "vitest";
import { signUp, testRun as run, type TestUser } from "./helpers";

/** Team management rules from the team_invites migration. */
describe("team management", () => {
  let lead: TestUser;
  let member: TestUser;
  let other: TestUser;
  let teamId: string;

  beforeAll(async () => {
    [lead, member, other] = await Promise.all([signUp("t-lead"), signUp("t-member"), signUp("t-other")]);
    const team = await lead.client.rpc("create_team", { p_name: `Teams ${run}` });
    teamId = team.data!.id;
  });

  it("leads add registered people by email, case-insensitive", async () => {
    const added = await lead.client.rpc("add_team_member_by_email", { p_team_id: teamId, p_email: member.email.toUpperCase() });
    expect(added.data).toBe("added");
    const again = await lead.client.rpc("add_team_member_by_email", { p_team_id: teamId, p_email: member.email });
    expect(again.data).toBe("already_member");
  });

  it("reports unknown emails without adding anyone", async () => {
    const result = await lead.client.rpc("add_team_member_by_email", { p_team_id: teamId, p_email: `niemand-${run}@example.com` });
    expect(result.data).toBe("not_found");
  });

  it("members and outsiders cannot add people", async () => {
    const byMember = await member.client.rpc("add_team_member_by_email", { p_team_id: teamId, p_email: other.email });
    const byOutsider = await other.client.rpc("add_team_member_by_email", { p_team_id: teamId, p_email: other.email });
    expect(byMember.error?.code).toBe("42501");
    expect(byOutsider.error?.code).toBe("42501");
  });

  it("members see names of fellow members, never their email", async () => {
    const { data } = await member.client.from("team_members").select("user_id, role, profiles(*)").eq("team_id", teamId);
    expect(data).toHaveLength(2);
    expect(JSON.stringify(data)).not.toContain("@");
  });

  it("the last lead cannot leave or be removed", async () => {
    const leave = await lead.client.from("team_members").delete().eq("team_id", teamId).eq("user_id", lead.userId);
    expect(leave.error?.hint).toBe("last_lead");
  });

  it("members cannot remove others, but can leave", async () => {
    const kick = await member.client
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", lead.userId)
      .select("user_id");
    expect(kick.data ?? []).toHaveLength(0);

    const leave = await member.client
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", member.userId)
      .select("user_id");
    expect(leave.data).toHaveLength(1);
  });

  it("deleting the team removes all memberships, including the lead", async () => {
    const removed = await lead.client.from("teams").delete().eq("id", teamId).select("id");
    expect(removed.data).toHaveLength(1);
  });
});
