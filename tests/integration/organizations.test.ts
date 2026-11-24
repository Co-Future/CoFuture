import { beforeAll, describe, expect, it } from "vitest";
import { POST as acceptInvite } from "@/app/api/invites/accept/route";
import { createAdminClient } from "@/lib/db/admin";
import { issueAccessLink } from "@/lib/organizations/invite-token";
import { answer, env, signUp, startExchange, testRun as run, type TestUser } from "./helpers";
import { createClient } from "@supabase/supabase-js";

/**
 * Organizations, roles and access links against staging (ADR 011).
 * People join an organization through the server (admin client), exactly like
 * POST /api/organizations/{id}/members does. Everything else runs as the signed-in user.
 */
describe("organizations and roles", () => {
  const admin = createAdminClient();
  let owner: TestUser;
  let member: TestUser;
  let other: TestUser; // member of the organization, but in no team with the guest
  let guest: TestUser;
  let outsider: TestUser;
  let orgId: string;
  let teamId: string;

  const join = async (user: TestUser, role: "owner" | "member" | "guest") => {
    const { error } = await admin.from("organization_members").insert({ organization_id: orgId, user_id: user.userId, role });
    if (error) throw error;
  };
  const errorHint = (error: { hint?: string } | null) => error?.hint;

  beforeAll(async () => {
    [owner, member, other, guest, outsider] = await Promise.all([
      signUp("o-owner"),
      signUp("o-member"),
      signUp("o-other"),
      signUp("o-guest"),
      signUp("o-out"),
    ]);
    const org = await owner.client.rpc("create_organization", { p_name: `Org ${run}` });
    if (org.error) throw org.error;
    orgId = org.data.id;
    await join(member, "member");
    await join(other, "member");
    await join(guest, "guest");
    await outsider.client.rpc("create_organization", { p_name: `Fremd ${run}` });

    const team = await member.client.rpc("create_team", { p_name: `Team ${run}`, p_organization_id: orgId });
    if (team.error) throw team.error;
    teamId = team.data.id;
    for (const u of [owner, guest]) {
      expect((await member.client.rpc("add_team_member", { p_team_id: teamId, p_user_id: u.userId })).data).toBe("added");
    }
  });

  describe("visibility", () => {
    it("outsiders see nothing of the organization", async () => {
      expect((await outsider.client.from("organizations").select("id").eq("id", orgId)).data).toEqual([]);
      expect((await outsider.client.from("organization_members").select("user_id").eq("organization_id", orgId)).data).toEqual(
        [],
      );
      expect((await outsider.client.from("teams").select("id").eq("id", teamId)).data).toEqual([]);
      expect((await outsider.client.from("profiles").select("id").eq("id", member.userId)).data).toEqual([]);
      const people = await outsider.client.rpc("organization_people", { p_org_id: orgId });
      expect(people.error?.code).toBe("42501");
    });

    it("only owners see email addresses", async () => {
      const asOwner = (await owner.client.rpc("organization_people", { p_org_id: orgId })).data!;
      expect(asOwner.find((p) => p.user_id === member.userId)?.email).toBe(member.email);
      const asMember = (await member.client.rpc("organization_people", { p_org_id: orgId })).data!;
      expect(asMember).toHaveLength(4);
      expect(asMember.every((p) => p.email === null)).toBe(true);
    });

    it("guests only see people they share a team with", async () => {
      const ids = (await guest.client.rpc("organization_people", { p_org_id: orgId })).data!.map((p) => p.user_id);
      expect(ids).toEqual(expect.arrayContaining([guest.userId, owner.userId, member.userId]));
      expect(ids).not.toContain(other.userId);
      expect((await guest.client.from("profiles").select("id").eq("id", other.userId)).data).toEqual([]);
    });

    it("access links are invisible to every client", async () => {
      await issueAccessLink(admin, {
        organizationId: orgId,
        userId: guest.userId,
        createdBy: owner.userId,
        origin: "http://test",
      });
      for (const u of [owner, guest]) {
        const { data } = await u.client.from("invites").select("id");
        expect(data ?? []).toEqual([]);
      }
    });
  });

  describe("no shortcuts around the functions", () => {
    it("members cannot change their own role or add themselves anywhere", async () => {
      await member.client.from("organization_members").update({ role: "owner" }).eq("user_id", member.userId);
      expect((await owner.client.rpc("is_org_admin", { p_org_id: orgId })).data).toBe(true);
      expect((await member.client.rpc("is_org_admin", { p_org_id: orgId })).data).toBe(false);
      const self = await outsider.client
        .from("organization_members")
        .insert({ organization_id: orgId, user_id: outsider.userId });
      expect(self.error).not.toBeNull();
      const invite = await outsider.client
        .from("invites")
        .insert({ organization_id: orgId, user_id: outsider.userId, token_hash: `x-${run}` });
      expect(invite.error).not.toBeNull();
    });

    it("nobody can create teams in an organization they are not in", async () => {
      const { error } = await outsider.client.rpc("create_team", { p_name: "Fremd", p_organization_id: orgId });
      expect(error?.code).toBe("42501");
    });

    it("teams only take people from their own organization", async () => {
      expect((await member.client.rpc("add_team_member", { p_team_id: teamId, p_user_id: outsider.userId })).data).toBe(
        "not_found",
      );
      expect((await member.client.rpc("add_team_member_by_email", { p_team_id: teamId, p_email: outsider.email })).data).toBe(
        "not_found",
      );
    });

    it("signed-in users cannot purge accounts", async () => {
      const { error } = await owner.client.rpc("purge_test_users", { p_run: run });
      expect(error).not.toBeNull();
    });
  });

  describe("guests", () => {
    it("cannot create teams or start rounds", async () => {
      expect((await guest.client.rpc("create_team", { p_name: "Gast-Team", p_organization_id: orgId })).error?.code).toBe(
        "42501",
      );
      const round = await guest.client
        .from("rounds")
        .insert({ team_id: teamId, question: "Darf ich?", deadline: new Date(Date.now() + 3_600_000).toISOString() });
      expect(round.error).not.toBeNull();
    });

    it("answer rounds that others started", async () => {
      const { roundId, questionIds } = await startExchange(member, teamId, ["Passt dir der Gästetermin?"], {
        deadlineMs: 3_600_000,
      });
      expect((await answer(guest, roundId, questionIds[0], "Ja")).error).toBeNull();
    });

    it("cannot be made team lead", async () => {
      const { error } = await member.client.rpc("transfer_team", { p_team_id: teamId, p_user_id: guest.userId });
      expect(errorHint(error)).toBe("not_eligible");
    });
  });

  describe("owner actions", () => {
    it("only owners change roles, and the last owner stays", async () => {
      expect(
        (await member.client.rpc("set_organization_role", { p_org_id: orgId, p_user_id: other.userId, p_role: "guest" })).error
          ?.code,
      ).toBe("42501");
      const demoteSelf = await owner.client.rpc("set_organization_role", {
        p_org_id: orgId,
        p_user_id: owner.userId,
        p_role: "member",
      });
      expect(errorHint(demoteSelf.error)).toBe("last_owner");
    });

    it("only owners remove people, never themselves", async () => {
      expect(
        (await member.client.rpc("remove_organization_member", { p_org_id: orgId, p_user_id: other.userId })).error?.code,
      ).toBe("42501");
      const self = await owner.client.rpc("remove_organization_member", { p_org_id: orgId, p_user_id: owner.userId });
      expect(errorHint(self.error)).toBe("self");
    });

    it("removing a team's only lead hands the team to the owner, and the person loses access", async () => {
      const { error } = await owner.client.rpc("remove_organization_member", { p_org_id: orgId, p_user_id: member.userId });
      expect(error).toBeNull();
      const { data: lead } = await owner.client.from("team_members").select("user_id").eq("team_id", teamId).eq("role", "lead");
      expect(lead).toEqual([{ user_id: owner.userId }]);
      expect((await member.client.from("teams").select("id").eq("id", teamId)).data).toEqual([]);
      expect((await member.client.from("organizations").select("id").eq("id", orgId)).data).toEqual([]);
    });

    it("teams and organizations can only be deleted when empty", async () => {
      expect(errorHint((await owner.client.rpc("delete_team", { p_team_id: teamId })).error)).toBe("not_empty");
      expect(errorHint((await owner.client.rpc("delete_organization", { p_org_id: orgId })).error)).toBe("not_empty");
      expect((await other.client.rpc("delete_team", { p_team_id: teamId })).error?.code).toBe("42501");
    });

    it("handing over the organization swaps the roles", async () => {
      expect((await owner.client.rpc("transfer_organization", { p_org_id: orgId, p_user_id: other.userId })).error).toBeNull();
      expect((await other.client.rpc("is_org_admin", { p_org_id: orgId })).data).toBe(true);
      expect((await owner.client.rpc("is_org_admin", { p_org_id: orgId })).data).toBe(false);
      const back = await owner.client.rpc("set_organization_role", { p_org_id: orgId, p_user_id: owner.userId, p_role: "owner" });
      expect(back.error?.code).toBe("42501");
    });
  });
});

describe("access links", () => {
  const admin = createAdminClient();
  let owner: TestUser;
  let orgId: string;
  let invitee: { id: string; email: string };

  const accept = (token: string, password: string) =>
    acceptInvite(new Request("http://test/api/invites/accept", { method: "POST", body: JSON.stringify({ token, password }) }));
  const tokenOf = (link: string) => link.split("/zugang/")[1]!;
  const newLink = () =>
    issueAccessLink(admin, { organizationId: orgId, userId: invitee.id, createdBy: owner.userId, origin: "http://test" });

  beforeAll(async () => {
    owner = await signUp("l-owner");
    orgId = (await owner.client.rpc("create_organization", { p_name: `Links ${run}` })).data!.id;
    // Same as "Person hinzufügen": account without password, managed by the organization.
    const email = `cofuture.test+${run}-l-new@gmail.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: "Neu" },
    });
    if (error) throw error;
    invitee = { id: data.user.id, email };
    await admin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: invitee.id, role: "member", managed: true });
  });

  it("stores only a hash of the token", async () => {
    const token = tokenOf(await newLink());
    const { data } = await admin.from("invites").select("token_hash").eq("user_id", invitee.id);
    expect(data).toHaveLength(1);
    expect(data![0].token_hash).not.toContain(token);
    expect(data![0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a new link invalidates the old one", async () => {
    const old = tokenOf(await newLink());
    await newLink();
    expect((await accept(old, `Neu-${crypto.randomUUID()}`)).status).toBe(410);
  });

  it("expired links do not work", async () => {
    const token = tokenOf(await newLink());
    await admin
      .from("invites")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("user_id", invitee.id);
    expect((await accept(token, `Neu-${crypto.randomUUID()}`)).status).toBe(410);
  });

  it("a link sets the password once, then signing in works", async () => {
    const token = tokenOf(await newLink());
    const password = `Neu-${crypto.randomUUID()}`;
    const first = await accept(token, password);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ email: invitee.email });

    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect((await client.auth.signInWithPassword({ email: invitee.email, password })).error).toBeNull();

    expect((await accept(token, `Anders-${crypto.randomUUID()}`)).status).toBe(410);
  });

  it("garbage tokens are rejected", async () => {
    const res = await accept("x".repeat(43), `Neu-${crypto.randomUUID()}`);
    expect([400, 410]).toContain(res.status);
  });
});
