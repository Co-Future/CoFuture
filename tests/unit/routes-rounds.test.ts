import { beforeEach, describe, expect, it, vi } from "vitest";
import { argsOf, DECISION, fakeClient, jsonRequest, JOB, OTHER_USER, params, ROUND, USER, type FakeClient } from "./support/fake-supabase";

const state = vi.hoisted(() => ({ client: null as unknown, after: [] as (() => unknown)[] }));

vi.mock("@/lib/db/server", () => ({ createClient: async () => state.client }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => state.after.push(task) }));
vi.mock("@/lib/jobs/transcribe", () => ({ runTranscribeJobs: vi.fn(async () => ({ processed: 1, done: 1, failed: 0 })) }));

import { PUT as putResponse } from "@/app/api/rounds/[roundId]/response/route";
import { PATCH as closeRound } from "@/app/api/rounds/[roundId]/route";
import { POST as postVoice } from "@/app/api/rounds/[roundId]/voice/route";
import { POST as postDecision } from "@/app/api/rounds/[roundId]/decision/route";
import { POST as readDecision } from "@/app/api/decisions/[decisionId]/read/route";
import { runTranscribeJobs } from "@/lib/jobs/transcribe";

function setClient(client: FakeClient) {
  state.client = client;
  return client;
}

async function errorCode(res: Response) {
  return ((await res.json()) as { error: { code: string } }).error.code;
}

beforeEach(() => {
  state.after = [];
  vi.clearAllMocks();
});

describe("PUT /api/rounds/{roundId}/response", () => {
  const answer = (body: unknown) => putResponse(jsonRequest(body, { method: "PUT" }), params({ roundId: ROUND }));

  it("answers 404 for a round id that is not a uuid, without touching the database", async () => {
    const client = setClient(fakeClient());
    const res = await putResponse(jsonRequest({ body: "Ja" }, { method: "PUT" }), params({ roundId: "1 or 1=1" }));
    expect(res.status).toBe(404);
    expect(client.queries).toHaveLength(0);
  });

  it("asks signed-out visitors to sign in", async () => {
    setClient(fakeClient({ userId: null }));
    const res = await answer({ body: "Ja" });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("unauthenticated");
  });

  it("rejects an empty answer with a field message", async () => {
    setClient(fakeClient());
    const res = await answer({ body: "   " });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { fields: { body: "Schreib eine Antwort." } } });
  });

  it("creates the first answer and returns only the pseudonym", async () => {
    const client = setClient(fakeClient({ tables: { responses: [{ data: null }, { data: { pseudonym: "A01" } }] } }));
    const res = await answer({ body: "  Ich bin dafür. " });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ pseudonym: "A01" });
    // The database sets user and pseudonym itself; the route never sends a user id along.
    expect(argsOf(client, "responses", "insert")).toEqual([{ round_id: ROUND, body: "Ich bin dafür.", source: "text" }]);
  });

  it("updates an existing answer instead of adding a second one", async () => {
    const client = setClient(fakeClient({ tables: { responses: [{ data: { id: "r1" } }, { data: [{ pseudonym: "A02" }] }] } }));
    const res = await answer({ body: "Doch dagegen." });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pseudonym: "A02" });
    expect(argsOf(client, "responses", "insert")).toBeUndefined();
    expect(argsOf(client, "responses", "update")).toEqual([{ body: "Doch dagegen.", source: "text" }]);
  });

  it("reports a closed round when the update changes nothing", async () => {
    setClient(fakeClient({ tables: { responses: [{ data: { id: "r1" } }, { data: [] }] } }));
    const res = await answer({ body: "Zu spät" });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("round_closed");
  });

  it("reports a closed round when RLS refuses the insert", async () => {
    setClient(fakeClient({ tables: { responses: [{ data: null }, { error: { code: "42501" } }] } }));
    const res = await answer({ body: "Zu spät" });
    expect(res.status).toBe(409);
  });

  it("answers 500 on other database errors", async () => {
    setClient(fakeClient({ tables: { responses: [{ data: null }, { error: { code: "XX000" } }] } }));
    expect((await answer({ body: "Ja" })).status).toBe(500);
  });
});

describe("PATCH /api/rounds/{roundId}", () => {
  const close = (body: unknown) => closeRound(jsonRequest(body, { method: "PATCH" }), params({ roundId: ROUND }));

  it("closes the round for its creator or the lead", async () => {
    setClient(fakeClient({ tables: { rounds: [{ data: [{ id: ROUND, status: "closed" }] }] } }));
    const res = await close({ status: "closed" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ROUND, status: "closed" });
  });

  it("does not allow reopening through the API", async () => {
    setClient(fakeClient());
    expect((await close({ status: "open" })).status).toBe(400);
  });

  it("forbids it for everyone else (RLS returns no row)", async () => {
    setClient(fakeClient({ tables: { rounds: [{ data: [] }] } }));
    const res = await close({ status: "closed" });
    expect(res.status).toBe(403);
  });

  it("reports a round that is already closed", async () => {
    setClient(fakeClient({ tables: { rounds: [{ error: { hint: "invalid_status" } }] } }));
    const res = await close({ status: "closed" });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe("invalid_status");
  });
});

describe("POST /api/rounds/{roundId}/voice", () => {
  const file = "99999999-9999-4999-8999-999999999999";
  const send = (body: unknown) => postVoice(jsonRequest(body), params({ roundId: ROUND }));

  it("queues a transcription job and starts it after the response", async () => {
    const client = setClient(fakeClient({ tables: { analysis_jobs: [{ data: { id: JOB } }] } }));
    const res = await send({ path: `${USER}/${file}.webm`, mime: "audio/webm", durationMs: 30_000 });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: JOB });
    expect(argsOf(client, "analysis_jobs", "insert")).toEqual([
      { kind: "transcribe", round_id: ROUND, payload: { path: `${USER}/${file}.webm`, mime: "audio/webm", durationMs: 30_000 } },
    ]);

    expect(state.after).toHaveLength(1);
    await state.after[0]!();
    expect(runTranscribeJobs).toHaveBeenCalledWith({ jobId: JOB });
  });

  it("refuses recordings from someone else's folder", async () => {
    const client = setClient(fakeClient());
    const res = await send({ path: `${OTHER_USER}/${file}.webm`, mime: "audio/webm", durationMs: 1_000 });
    expect(res.status).toBe(403);
    expect(client.queries).toHaveLength(0);
    expect(state.after).toHaveLength(0);
  });

  it("reports a closed round", async () => {
    setClient(fakeClient({ tables: { analysis_jobs: [{ error: { code: "42501" } }] } }));
    const res = await send({ path: `${USER}/${file}.ogg`, mime: "audio/ogg", durationMs: 1_000 });
    expect(res.status).toBe(409);
    expect(state.after).toHaveLength(0);
  });
});

describe("POST /api/rounds/{roundId}/decision", () => {
  const decide = (body: unknown) => postDecision(jsonRequest(body), params({ roundId: ROUND }));
  const valid = { body: "Wir testen die Hotline drei Monate.", rationale: "Mehrheit dafür, Bedenken zu Kosten bleiben offen.", clusterRefs: [3, 1, 3] };

  it("records the decision made by a person, with sorted cluster references", async () => {
    const client = setClient(fakeClient({ rpc: { decide_round: [{ data: { id: DECISION } }] } }));
    const res = await decide(valid);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: DECISION });
    expect(argsOf(client, "rpc:decide_round", "rpc")).toEqual([
      { p_round_id: ROUND, p_body: valid.body, p_rationale: valid.rationale, p_cluster_refs: [1, 3] },
    ]);
  });

  it("needs a rationale", async () => {
    setClient(fakeClient());
    const res = await decide({ ...valid, rationale: "" });
    expect(res.status).toBe(400);
  });

  it.each([
    [{ code: "P0002" }, 404, "not_found"],
    [{ code: "42501" }, 403, "forbidden"],
    [{ hint: "round_open" }, 409, "round_open"],
    [{ hint: "already_decided" }, 409, "already_decided"],
    [{ code: "XX000" }, 500, "decide_failed"],
  ])("maps database error %o to %i %s", async (error, status, code) => {
    setClient(fakeClient({ rpc: { decide_round: [{ error }] } }));
    const res = await decide(valid);
    expect(res.status).toBe(status);
    expect(await errorCode(res)).toBe(code);
  });
});

describe("POST /api/decisions/{decisionId}/read", () => {
  const read = () => readDecision(new Request("http://localhost/api", { method: "POST" }), params({ decisionId: DECISION }));

  it("stores the read receipt for the signed-in user, idempotently", async () => {
    const client = setClient(fakeClient());
    const res = await read();
    expect(res.status).toBe(204);
    expect(argsOf(client, "decision_reads", "upsert")).toEqual([
      { decision_id: DECISION, user_id: USER },
      { onConflict: "decision_id,user_id", ignoreDuplicates: true },
    ]);
  });

  it("answers 404 for decisions you cannot see or that do not exist", async () => {
    setClient(fakeClient({ tables: { decision_reads: [{ error: { code: "42501" } }] } }));
    expect((await read()).status).toBe(404);
    setClient(fakeClient({ tables: { decision_reads: [{ error: { code: "23503" } }] } }));
    expect((await read()).status).toBe(404);
  });
});
