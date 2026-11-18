import { beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/db/admin";
import { isManagedAccount } from "@/lib/organizations/invite-token";
import { signUp, testRun as run, type TestUser } from "./helpers";

/**
 * Invitations with confirmation (ADR 011): people who already have an account only join an
 * organization once they accept. Runs against staging as the signed-in users.
 */
describe("organization invitations", () => {
  const admin = createAdminClient();
  let owner: TestUser;
  let member: TestUser;
  let invitee: TestUser;
  let outsider: TestUser;
  let orgId: string;
  let teamA: string;
  let teamB: string;
  let foreignTeam: string;

  const invite = (by: TestUser, email: string, role: "owner" | "member" | "guest" = "member", teams: string[] = []) =>
    by.client.rpc("invite_to_organization", { p_org_id: orgId, p_email: email, p_role: role, p_team_ids: teams });
  const myInvitations = (u: TestUser) => u.client.rpc("my_organization_invitations");
  const isMember = async (u: TestUser) =>
    (await admin.from("organization_members").select("user_id").eq("organization_id", orgId).eq("user_id", u.userId)).data!
      .length === 1;
  const invitationId = async (u: TestUser) => (await myInvitations(u)).data![0]!.id;

  beforeAll(async () => {
    [owner, member, invitee, outsider] = await Promise.all([
      signUp("i-owner"),
      signUp("i-member"),
      signUp("i-invitee"),
      signUp("i-out"),
    ]);
    const org = await owner.client.rpc("create_organization", { p_name: `Einladung ${run}` });
    if (org.error) throw org.error;
    orgId = org.data.id;
    const { error } = await admin.from("organization_members").insert({ organization_id: orgId, user_id: member.userId, role: "member" });
    if (error) throw error;
    teamA = (await owner.client.rpc("create_team", { p_name: `A ${run}`, p_organization_id: orgId })).data!.id;
    teamB = (await owner.client.rpc("create_team", { p_name: `B ${run}`, p_organization_id: orgId })).data!.id;
    const other = await outsider.client.rpc("create_organization", { p_name: `Fremd ${run}` });
    foreignTeam = (await outsider.client.rpc("create_team", { p_name: `F ${run}`, p_organization_id: other.data!.id })).data!.id;
  });

  describe("inviting", () => {
    it("only owners invite", async () => {
      const { error } = await invite(member, invitee.email);
      expect(error?.code).toBe("42501");
      expect((await invite(outsider, invitee.email)).error?.code).toBe("42501");
    });

    it("rejects teams of another organization and unknown emails", async () => {
      expect((await invite(owner, invitee.email, "member", [foreignTeam])).data).toBe("invalid_team");
      expect((await invite(owner, `cofuture.test+${run}-niemand@gmail.com`)).data).toBe("not_found");
    });

    it("never invites members", async () => {
      expect((await invite(owner, member.email)).data).toBe("already_member");
      expect((await invite(owner, owner.email.toUpperCase())).data).toBe("already_member");
    });

    it("creates one invitation, no membership, and no duplicates", async () => {
      expect((await invite(owner, invitee.email, "guest", [teamA, teamB, teamA])).data).toBe("invited");
      expect((await invite(owner, ` ${invitee.email.toUpperCase()} `, "owner")).data).toBe("already_invited");
      expect(await isMember(invitee)).toBe(false);
      const { data } = await admin.from("organization_invitations").select("role, team_ids").eq("user_id", invitee.userId);
      expect(data).toHaveLength(1);
      expect(data![0]!.role).toBe("guest");
      expect([...data![0]!.team_ids].sort()).toEqual([teamA, teamB].sort());
    });
  });

  describe("visibility", () => {
    it("the invited person sees the organization name, role and teams, but nothing of the organization itself", async () => {
      const { data } = await myInvitations(invitee);
      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({ organization_id: orgId, organization_name: `Einladung ${run}`, role: "guest" });
      expect([...data![0]!.team_names].sort()).toEqual([`A ${run}`, `B ${run}`]);
      expect(data![0]!.invited_by_name).toBe("Test i-owner");
      expect((await invitee.client.from("organizations").select("id").eq("id", orgId)).data).toEqual([]);
      expect((await invitee.client.from("teams").select("id").eq("id", teamA)).data).toEqual([]);
    });

    it("owners see open invitations with email, members and outsiders do not", async () => {
      const { data } = await owner.client.rpc("organization_invitations_list", { p_org_id: orgId });
      expect(data?.map((i) => i.email)).toEqual([invitee.email]);
      expect((await member.client.rpc("organization_invitations_list", { p_org_id: orgId })).error?.code).toBe("42501");
      expect((await member.client.from("organization_invitations").select("id")).data).toEqual([]);
      expect((await outsider.client.from("organization_invitations").select("id")).data).toEqual([]);
      expect((await myInvitations(outsider)).data).toEqual([]);
    });
  });

  describe("no shortcuts", () => {
    it("clients cannot write invitations directly", async () => {
      const insert = await outsider.client
        .from("organization_invitations")
        .insert({ organization_id: orgId, user_id: outsider.userId, role: "owner" });
      expect(insert.error).not.toBeNull();
      await invitee.client.from("organization_invitations").update({ role: "owner" }).eq("user_id", invitee.userId);
      expect((await myInvitations(invitee)).data![0]!.role).toBe("guest");
    });

    it("an invited person cannot be put into a team before accepting", async () => {
      expect((await owner.client.rpc("add_team_member", { p_team_id: teamA, p_user_id: invitee.userId })).data).toBe(
        "not_found",
      );
      expect((await owner.client.rpc("add_team_member_by_email", { p_team_id: teamA, p_email: invitee.email })).data).toBe(
        "not_found",
      );
      const direct = await owner.client.from("team_members").insert({ team_id: teamA, user_id: invitee.userId, role: "member" });
      expect(direct.error?.hint).toBe("not_in_org");
    });

    it("nobody else can accept, decline or withdraw", async () => {
      const id = await invitationId(invitee);
      for (const u of [outsider, member]) {
        expect((await u.client.rpc("accept_organization_invitation", { p_invitation_id: id })).error?.code).toBe("P0002");
        expect((await u.client.rpc("delete_organization_invitation", { p_invitation_id: id })).error?.code).toBe("P0002");
      }
      expect(await isMember(outsider)).toBe(false);
      expect((await myInvitations(invitee)).data).toHaveLength(1);
    });
  });

  describe("answering", () => {
    it("declining removes the invitation and changes nothing else", async () => {
      const id = await invitationId(invitee);
      expect((await invitee.client.rpc("delete_organization_invitation", { p_invitation_id: id })).error).toBeNull();
      expect((await myInvitations(invitee)).data).toEqual([]);
      expect(await isMember(invitee)).toBe(false);
    });

    it("owners withdraw an invitation", async () => {
      expect((await invite(owner, invitee.email)).data).toBe("invited");
      const id = await invitationId(invitee);
      expect((await owner.client.rpc("delete_organization_invitation", { p_invitation_id: id })).error).toBeNull();
      expect((await myInvitations(invitee)).data).toEqual([]);
    });

    it("accepting joins with the invited role and the teams that still exist", async () => {
      const teamGone = (await owner.client.rpc("create_team", { p_name: `Weg ${run}`, p_organization_id: orgId })).data!.id;
      expect((await invite(owner, invitee.email, "guest", [teamA, teamGone])).data).toBe("invited");
      expect((await owner.client.rpc("delete_team", { p_team_id: teamGone })).error).toBeNull();

      const id = await invitationId(invitee);
      const { data, error } = await invitee.client.rpc("accept_organization_invitation", { p_invitation_id: id });
      expect(error).toBeNull();
      expect(data).toBe(orgId);

      const { data: membership } = await admin
        .from("organization_members")
        .select("role, managed")
        .eq("organization_id", orgId)
        .eq("user_id", invitee.userId)
        .single();
      expect(membership).toEqual({ role: "guest", managed: false });
      const teams = (await invitee.client.from("team_members").select("team_id").eq("user_id", invitee.userId)).data!;
      expect(teams.map((t) => t.team_id)).toEqual([teamA]);
      expect((await myInvitations(invitee)).data).toEqual([]);
      expect((await invitee.client.rpc("accept_organization_invitation", { p_invitation_id: id })).error?.code).toBe("P0002");
    });

    it("joining another way removes an open invitation", async () => {
      expect((await invite(owner, outsider.email)).data).toBe("invited");
      await admin.from("organization_members").insert({ organization_id: orgId, user_id: outsider.userId, role: "member" });
      expect((await myInvitations(outsider)).data).toEqual([]);
      await admin.from("organization_members").delete().eq("organization_id", orgId).eq("user_id", outsider.userId);
    });
  });

  describe("access links and invitations do not mix", () => {
    it("owners cannot issue access links for accounts that joined by invitation", async () => {
      expect(await isManagedAccount(admin, orgId, invitee.userId)).toBe(false);
    });

    it("an account the organization created stops being managed once it joins another organization", async () => {
      const email = `cofuture.test+${run}-i-managed@gmail.com`;
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { display_name: "Neu" } });
      if (error) throw error;
      const userId = data.user.id;
      await admin.from("organization_members").insert({ organization_id: orgId, user_id: userId, role: "member", managed: true });
      expect(await isManagedAccount(admin, orgId, userId)).toBe(true);

      // The other organization only gets an invitation, and the managing organization keeps its rights until it is accepted.
      const other = (await outsider.client.from("organizations").select("id").eq("name", `Fremd ${run}`).single()).data!.id;
      const res = await outsider.client.rpc("invite_to_organization", { p_org_id: other, p_email: email });
      expect(res.data).toBe("invited");
      expect(await isManagedAccount(admin, orgId, userId)).toBe(true);

      await admin.from("organization_members").insert({ organization_id: other, user_id: userId, role: "member" });
      expect(await isManagedAccount(admin, orgId, userId)).toBe(false);
    });
  });
});
