import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import { requireUserId } from "@/lib/api/respond";
import { orgRoleHint, orgRoleLabel, orgRoles } from "@/lib/organizations/roles";
import { teamDotClass } from "@/lib/teams/my-teams";
import { addTeamMemberSchema, createTeamSchema } from "@/lib/validation/team";
import { fakeClient, USER } from "./support/fake-supabase";

vi.mock("@/lib/db/server", () => ({ createClient: async () => null }));

const fetchMock = vi.fn<typeof fetch>();

describe("apiFetch", () => {
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends JSON and returns the data", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: "t1" }, { status: 201 }));
    expect(await apiFetch("/api/teams", { method: "POST", body: { name: "Vertrieb" } })).toEqual({ ok: true, data: { id: "t1" } });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(init.body).toBe('{"name":"Vertrieb"}');
  });

  it("sends no body and no content type without a body", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await apiFetch("/api/x", { method: "POST" })).toEqual({ ok: true, data: null });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ headers: undefined, body: undefined });
  });

  it("passes the uniform error through", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "round_closed", message: "Die Runde ist geschlossen." } }, { status: 409 }));
    expect(await apiFetch("/api/x", { method: "PUT", body: {} })).toEqual({
      ok: false,
      error: { code: "round_closed", message: "Die Runde ist geschlossen." },
    });
  });

  it("falls back to a generic message for unexpected error pages", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad Gateway</html>", { status: 502 }));
    expect(await apiFetch("/api/x", { method: "GET" })).toEqual({ ok: false, error: { code: "unknown", message: "Das hat nicht geklappt." } });
  });

  it("never throws when the network is gone", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await apiFetch("/api/x", { method: "GET" });
    expect(result).toMatchObject({ ok: false, error: { code: "network" } });
  });
});

describe("requireUserId", () => {
  it("returns the id of the signed-in user", async () => {
    expect(await requireUserId(fakeClient() as never)).toEqual({ userId: USER });
  });

  it("returns a ready-made 401 otherwise", async () => {
    const result = await requireUserId(fakeClient({ userId: null }) as never);
    if (!("response" in result)) throw new Error("expected a response");
    expect(result.response.status).toBe(401);
  });
});

describe("teams", () => {
  it("adds people by id inside an organization or by email without one", () => {
    expect(addTeamMemberSchema.safeParse({ userId: USER }).success).toBe(true);
    expect(addTeamMemberSchema.parse({ email: " A@B.de " })).toEqual({ email: "a@b.de" });
    expect(addTeamMemberSchema.safeParse({ userId: "x" }).success).toBe(false);
  });

  it("limits team names to 80 characters", () => {
    expect(createTeamSchema.safeParse({ name: "x".repeat(80) }).success).toBe(true);
    expect(createTeamSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });

  it("uses the six category colors in their fixed order, then starts over", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(teamDotClass)).toEqual([
      "bg-cat-blau",
      "bg-cat-orange",
      "bg-cat-teal",
      "bg-cat-pflaume",
      "bg-cat-gold",
      "bg-cat-schiefer",
      "bg-cat-blau",
    ]);
  });
});

describe("organization roles", () => {
  it("has a German label and a hint for every role", () => {
    expect(orgRoles.map((r) => orgRoleLabel[r])).toEqual(["Owner", "Mitglied", "Gast"]);
    for (const role of orgRoles) expect(orgRoleHint[role].length).toBeGreaterThan(10);
  });
});
