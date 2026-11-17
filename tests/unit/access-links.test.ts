import { describe, expect, it } from "vitest";
import { findValidInvite, hashToken, isManagedAccount, issueAccessLink } from "@/lib/organizations/invite-token";
import { argsOf, fakeClient, ORG, OTHER_USER, queriesOn, USER } from "./support/fake-supabase";

const admin = (options: Parameters<typeof fakeClient>[0]) => fakeClient(options);
const hour = 3_600_000;

describe("issueAccessLink", () => {
  it("replaces older unused links and stores only the hash of the new token", async () => {
    const client = fakeClient();
    const link = await issueAccessLink(client as never, {
      organizationId: ORG,
      userId: OTHER_USER,
      createdBy: USER,
      origin: "https://cofuture.example",
    });

    const token = link.match(/^https:\/\/cofuture\.example\/zugang\/([A-Za-z0-9_-]{43})$/)?.[1];
    expect(token).toBeDefined();
    const [deleteQuery] = queriesOn(client, "invites");
    expect(deleteQuery!.calls).toEqual([
      { method: "delete", args: [] },
      { method: "eq", args: ["user_id", OTHER_USER] },
      { method: "is", args: ["used_at", null] },
    ]);
    const [row] = argsOf(client, "invites", "insert") as [Record<string, string>];
    expect(row).toEqual({ organization_id: ORG, user_id: OTHER_USER, created_by: USER, token_hash: hashToken(token!) });
    expect(JSON.stringify(row)).not.toContain(token!);
  });

  it("creates a different token every time", async () => {
    const params = { organizationId: ORG, userId: OTHER_USER, createdBy: USER, origin: "http://localhost:3000" };
    const [a, b] = await Promise.all([issueAccessLink(fakeClient() as never, params), issueAccessLink(fakeClient() as never, params)]);
    expect(a).not.toBe(b);
  });

  it("throws when the link cannot be stored", async () => {
    const client = fakeClient({ tables: { invites: [{}, { error: { message: "insert failed" } }] } });
    await expect(
      issueAccessLink(client as never, { organizationId: ORG, userId: OTHER_USER, createdBy: USER, origin: "http://x" }),
    ).rejects.toMatchObject({ message: "insert failed" });
  });
});

describe("findValidInvite", () => {
  const token = "B".repeat(43);
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: "inv-1",
    user_id: OTHER_USER,
    expires_at: new Date(Date.now() + hour).toISOString(),
    used_at: null,
    organizations: { name: "Testverein" },
    profiles: { display_name: "Test Person" },
    ...overrides,
  });

  it("looks the link up by hash and returns who it is for", async () => {
    const client = admin({ tables: { invites: [{ data: row() }] } });
    client.auth.admin.getUserById.mockResolvedValueOnce({ data: { user: { email: "person@example.test" } } });
    expect(await findValidInvite(client as never, token)).toEqual({
      id: "inv-1",
      userId: OTHER_USER,
      displayName: "Test Person",
      email: "person@example.test",
      organizationName: "Testverein",
    });
    expect(queriesOn(client, "invites")[0]!.calls).toContainEqual({ method: "eq", args: ["token_hash", hashToken(token)] });
  });

  it.each([
    ["unknown", null],
    ["used", row({ used_at: new Date().toISOString() })],
    ["expired", row({ expires_at: new Date(Date.now() - 1000).toISOString() })],
  ])("rejects an %s link", async (_label, data) => {
    expect(await findValidInvite(admin({ tables: { invites: [{ data }] } }) as never, token)).toBeNull();
  });

  it("rejects a link whose account is gone", async () => {
    expect(await findValidInvite(admin({ tables: { invites: [{ data: row() }] } }) as never, token)).toBeNull();
  });
});

describe("isManagedAccount", () => {
  const memberships = (data: unknown) => admin({ tables: { organization_members: [{ data }] } });

  it("is true only for an account the organization created and that is nowhere else", async () => {
    expect(await isManagedAccount(memberships([{ organization_id: ORG, managed: true }]) as never, ORG, OTHER_USER)).toBe(true);
  });

  it.each([
    ["not created by the organization", [{ organization_id: ORG, managed: false }]],
    ["managed by another organization", [{ organization_id: "other", managed: true }]],
    ["also in another organization", [{ organization_id: ORG, managed: true }, { organization_id: "other", managed: false }]],
    ["without any membership", null],
  ])("is false for an account %s", async (_label, data) => {
    expect(await isManagedAccount(memberships(data) as never, ORG, OTHER_USER)).toBe(false);
  });
});
