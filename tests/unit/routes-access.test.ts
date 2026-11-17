import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { argsOf, fakeClient, jsonRequest, JOB, ORG, OTHER_USER, params, queriesOn, TEAM, USER, type FakeClient } from "./support/fake-supabase";

const state = vi.hoisted(() => ({
  client: null as unknown,
  admin: null as unknown,
  org: null as { id: string; name: string; role: string } | null,
  invite: null as unknown,
  after: [] as (() => unknown)[],
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => state.client }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => state.admin }));
vi.mock("@/lib/organizations/current", () => ({ getCurrentOrganization: async () => state.org }));
vi.mock("@/lib/organizations/invite-token", () => ({
  findValidInvite: vi.fn(async () => state.invite),
  issueAccessLink: vi.fn(async (_admin: unknown, p: { origin: string }) => `${p.origin}/zugang/${"t".repeat(43)}`),
}));
vi.mock("next/server", () => ({ after: (task: () => unknown) => state.after.push(task) }));
vi.mock("@/lib/jobs/transcribe", () => ({
  runTranscribeJobs: vi.fn(async () => ({ processed: 0, done: 0, failed: 0 })),
  sweepOldAudio: vi.fn(async () => 0),
}));
vi.mock("@/lib/jobs/analyze", () => ({ runAnalyzeJobs: vi.fn(async () => ({ processed: 0, done: 0, failed: 0 })) }));

import { POST as acceptInvite } from "@/app/api/invites/accept/route";
import { POST as retryJob } from "@/app/api/jobs/[jobId]/retry/route";
import { POST as addPerson } from "@/app/api/organizations/[orgId]/members/route";
import { POST as createTeam } from "@/app/api/teams/route";
import { POST as runWorker } from "@/app/api/worker/route";
import { runAnalyzeJobs } from "@/lib/jobs/analyze";
import { runTranscribeJobs, sweepOldAudio } from "@/lib/jobs/transcribe";

const setClient = (client: FakeClient) => (state.client = client);
const setAdmin = (admin: FakeClient) => (state.admin = admin);
const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

beforeEach(() => {
  state.after = [];
  state.org = null;
  state.invite = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/worker", () => {
  const secret = "w".repeat(32);
  const call = (authorization?: string) =>
    runWorker(new Request("http://localhost/api/worker", { method: "POST", headers: authorization ? { authorization } : {} }));

  it("refuses every call while no secret is configured", async () => {
    vi.stubEnv("WORKER_SECRET", undefined);
    expect((await call(`Bearer ${secret}`)).status).toBe(401);
    expect(runTranscribeJobs).not.toHaveBeenCalled();
  });

  it("refuses a missing, shorter or wrong secret", async () => {
    vi.stubEnv("WORKER_SECRET", secret);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer kurz")).status).toBe(401);
    expect((await call(`Bearer ${"x".repeat(32)}`)).status).toBe(401);
    expect(runAnalyzeJobs).not.toHaveBeenCalled();
  });

  it("runs transcription, analysis and the audio sweep with the right secret", async () => {
    vi.stubEnv("WORKER_SECRET", secret);
    const res = await call(`bearer ${secret}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      transcribe: { processed: 0, done: 0, failed: 0 },
      analyze: { processed: 0, done: 0, failed: 0 },
      sweptAudio: 0,
    });
    expect(runTranscribeJobs).toHaveBeenCalledWith({ limit: 10 });
    expect(runAnalyzeJobs).toHaveBeenCalledWith({ limit: 2 });
    expect(sweepOldAudio).toHaveBeenCalled();
  });
});

describe("POST /api/invites/accept", () => {
  const token = "A".repeat(43);
  const accept = (password = "Neues-Passwort-1") => acceptInvite(jsonRequest({ token, password }));
  const invite = { id: "inv-1", userId: OTHER_USER, displayName: "Test Person", email: "person@example.test", organizationName: "Testverein" };

  it("rejects malformed tokens before looking anything up", async () => {
    setAdmin(fakeClient());
    const res = await acceptInvite(jsonRequest({ token: "kurz", password: "Neues-Passwort-1" }));
    expect(res.status).toBe(400);
  });

  it("answers 410 for expired or used links", async () => {
    setAdmin(fakeClient());
    const res = await accept();
    expect(res.status).toBe(410);
    expect(await errorCode(res)).toBe("invite_invalid");
  });

  it("sets the password once and uses up the link", async () => {
    state.invite = invite;
    const admin = fakeClient({ tables: { invites: [{ data: [{ id: "inv-1" }] }] } });
    setAdmin(admin);
    const res = await accept();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: invite.email });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(OTHER_USER, { password: "Neues-Passwort-1" });
    // Only an unused link can be used up: that guards against two requests at once.
    expect(queriesOn(admin, "invites")[0]!.calls.map((c) => c.method)).toEqual(["update", "eq", "is", "select"]);
  });

  it("loses the race gracefully when the link was used in the meantime", async () => {
    state.invite = invite;
    const admin = fakeClient({ tables: { invites: [{ data: [] }] } });
    setAdmin(admin);
    expect((await accept()).status).toBe(410);
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("gives the link back when the password is too weak", async () => {
    state.invite = invite;
    const admin = fakeClient({ tables: { invites: [{ data: [{ id: "inv-1" }] }, {}] } });
    admin.auth.admin.updateUserById.mockResolvedValueOnce({ error: { code: "weak_password" } });
    setAdmin(admin);
    const res = await accept();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { fields: { password: expect.stringContaining("zu schwach") } } });
    expect(queriesOn(admin, "invites")[1]!.calls[0]).toEqual({ method: "update", args: [{ used_at: null }] });
  });
});

describe("POST /api/jobs/{jobId}/retry", () => {
  const retry = () => retryJob(new Request("http://localhost/api", { method: "POST" }), params({ jobId: JOB }));

  it("answers 404 for jobs you cannot see", async () => {
    setClient(fakeClient());
    expect((await retry()).status).toBe(404);
  });

  it("only retries failed jobs", async () => {
    setClient(fakeClient({ tables: { analysis_jobs: [{ data: { id: JOB, kind: "analyze", status: "running", attempts: 1 } }] } }));
    const res = await retry();
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("not_failed");
  });

  it("stops after three attempts and points to the original answers", async () => {
    setClient(fakeClient({ tables: { analysis_jobs: [{ data: { id: JOB, kind: "analyze", status: "failed", attempts: 3 } }] } }));
    const res = await retry();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: "no_attempts_left", message: expect.stringContaining("Original") } });
  });

  it("asks for a new recording when a transcription has no attempts left", async () => {
    setClient(fakeClient({ tables: { analysis_jobs: [{ data: { id: JOB, kind: "transcribe", status: "failed", attempts: 3 } }] } }));
    expect(await retry().then((r) => r.json())).toMatchObject({ error: { message: expect.stringContaining("neu auf") } });
  });

  it("requeues a failed analysis and runs it after the response", async () => {
    setClient(fakeClient({ tables: { analysis_jobs: [{ data: { id: JOB, kind: "analyze", status: "failed", attempts: 1 } }] } }));
    const admin = fakeClient();
    setAdmin(admin);
    const res = await retry();
    expect(res.status).toBe(202);
    expect(argsOf(admin, "analysis_jobs", "update")).toEqual([{ status: "pending", error: null }]);
    await state.after[0]!();
    expect(runAnalyzeJobs).toHaveBeenCalledWith({ jobId: JOB });
    expect(runTranscribeJobs).not.toHaveBeenCalled();
  });
});

describe("POST /api/teams", () => {
  it("creates the team in the selected organization", async () => {
    state.org = { id: ORG, name: "Testverein", role: "member" };
    const client = fakeClient({ rpc: { create_team: [{ data: { id: TEAM, name: "Vertrieb" } }] } });
    setClient(client);
    const res = await createTeam(jsonRequest({ name: " Vertrieb " }));
    expect(res.status).toBe(201);
    expect(argsOf(client, "rpc:create_team", "rpc")).toEqual([{ p_name: "Vertrieb", p_organization_id: ORG }]);
  });

  it("works without an organization", async () => {
    const client = fakeClient({ rpc: { create_team: [{ data: { id: TEAM, name: "Vertrieb" } }] } });
    setClient(client);
    await createTeam(jsonRequest({ name: "Vertrieb" }));
    expect(argsOf(client, "rpc:create_team", "rpc")).toEqual([{ p_name: "Vertrieb" }]);
  });

  it("tells guests that they cannot create teams", async () => {
    setClient(fakeClient({ rpc: { create_team: [{ error: { code: "42501" } }] } }));
    const res = await createTeam(jsonRequest({ name: "Vertrieb" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { message: expect.stringContaining("Gast") } });
  });
});

describe("POST /api/organizations/{orgId}/members", () => {
  const person = { displayName: "Test Person", email: " Person@Example.test ", role: "guest" };
  const add = (body: unknown = person) =>
    addPerson(jsonRequest(body, { url: "https://cofuture.example/api/organizations" }), params({ orgId: ORG }));

  it("is for owners only", async () => {
    setClient(fakeClient({ rpc: { is_org_admin: [{ data: false }] } }));
    const admin = fakeClient();
    setAdmin(admin);
    expect((await add()).status).toBe(403);
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("creates a managed account and returns a one-time access link", async () => {
    setClient(fakeClient({ rpc: { is_org_admin: [{ data: true }] } }));
    const admin = fakeClient();
    admin.auth.admin.createUser.mockResolvedValueOnce({ data: { user: { id: OTHER_USER } }, error: null });
    setAdmin(admin);
    const res = await add();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ userId: OTHER_USER, link: `https://cofuture.example/zugang/${"t".repeat(43)}` });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: "person@example.test",
      email_confirm: true,
      user_metadata: { display_name: "Test Person" },
    });
    expect(argsOf(admin, "organization_members", "insert")).toEqual([
      { organization_id: ORG, user_id: OTHER_USER, role: "guest", managed: true },
    ]);
  });

  it("rejects a team from another organization", async () => {
    setClient(fakeClient({ rpc: { is_org_admin: [{ data: true }] } }));
    setAdmin(fakeClient({ tables: { teams: [{ data: null }] } }));
    const res = await add({ ...person, teamId: TEAM });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { fields: { teamId: expect.any(String) } } });
  });

  it("removes the half-created account when the membership fails", async () => {
    setClient(fakeClient({ rpc: { is_org_admin: [{ data: true }] } }));
    const admin = fakeClient({ tables: { organization_members: [{ error: { code: "XX000" } }] } });
    admin.auth.admin.createUser.mockResolvedValueOnce({ data: { user: { id: OTHER_USER } }, error: null });
    setAdmin(admin);
    expect((await add()).status).toBe(500);
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(OTHER_USER);
  });

  it("adds an existing account without a link, so the person signs in as usual", async () => {
    setClient(fakeClient({ rpc: { is_org_admin: [{ data: true }] } }));
    const admin = fakeClient({ rpc: { find_user_id_by_email: [{ data: OTHER_USER }] } });
    admin.auth.admin.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "email_exists" } });
    setAdmin(admin);
    const res = await add();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ userId: OTHER_USER, link: null });
    // Not managed: the organization did not create this account, so it may not reset its password.
    expect(argsOf(admin, "organization_members", "insert")).toEqual([{ organization_id: ORG, user_id: OTHER_USER, role: "guest" }]);
  });

  it("reports a person who is already in the organization", async () => {
    setClient(fakeClient({ rpc: { is_org_admin: [{ data: true }] } }));
    const admin = fakeClient({
      rpc: { find_user_id_by_email: [{ data: USER }] },
      tables: { organization_members: [{ error: { code: "23505" } }] },
    });
    admin.auth.admin.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "email_exists" } });
    setAdmin(admin);
    const res = await add();
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("already_member");
  });
});
