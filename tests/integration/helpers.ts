import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";

/** Creates throwaway test users with made-up data. Needs email confirmation switched off. */
export const env = publicEnv();
const run = crypto.randomUUID().slice(0, 8);

export type TestUser = { client: SupabaseClient<Database>; userId: string; email: string };

export async function signUp(name: string): Promise<TestUser> {
  const client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `cofuture.test+${run}-${name}@gmail.com`;
  const { data, error } = await client.auth.signUp({
    email,
    password: `Test-${crypto.randomUUID()}`,
    options: { data: { display_name: `Test ${name}` } },
  });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error("No session: is email confirmation switched off?");
  return { client, userId: data.user.id, email };
}

export const testRun = run;

/**
 * Deletes all accounts of this run (and teams only they were in). Needs SUPABASE_SECRET_KEY;
 * without it the hourly database job purge-test-users cleans up.
 */
export async function cleanUpTestRun(): Promise<void> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return;
  const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.rpc("purge_test_users", { p_run: run });
  if (error) console.warn(`Testnutzer konnten nicht gelöscht werden: ${error.message}`);
}

type Role = "member" | "guest";

/**
 * An organization owned by `owner` with one team: the way the app sets people up.
 * Members join the organization through the admin client (like POST /api/organizations/{id}/members)
 * and are added to the team by the owner.
 */
export async function setUpTeam(
  owner: TestUser,
  people: { user: TestUser; role?: Role }[],
  name: string,
): Promise<{ orgId: string; teamId: string }> {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is needed to add people to an organization.");
  const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const org = await owner.client.rpc("create_organization", { p_name: `${name} ${run}` });
  if (org.error) throw org.error;
  if (people.length) {
    const { error } = await admin
      .from("organization_members")
      .insert(people.map((p) => ({ organization_id: org.data.id, user_id: p.user.userId, role: p.role ?? "member" })));
    if (error) throw error;
  }
  const team = await owner.client.rpc("create_team", { p_name: `${name} ${run}`, p_organization_id: org.data.id });
  if (team.error) throw team.error;
  for (const p of people) {
    const added = await owner.client.rpc("add_team_member", { p_team_id: team.data.id, p_user_id: p.user.userId });
    if (added.error || added.data !== "added") throw added.error ?? new Error(`add_team_member: ${added.data}`);
  }
  return { orgId: org.data.id, teamId: team.data.id };
}

/**
 * Starts an exchange like the app does (create_exchange). Returns the round and its question ids in order.
 * A plain string is a question to everyone in the team, the starter included (asks_starter).
 */
export async function startExchange(
  by: TestUser,
  teamId: string,
  questions: (string | { body: string; targets?: string[]; asks_starter?: boolean })[],
  options: { deadlineMs?: number; parentRoundId?: string } = {},
): Promise<{ roundId: string; questionIds: string[] }> {
  const { data, error } = await by.client.rpc("create_exchange", {
    p_team_id: teamId,
    p_questions: questions.map((q) => (typeof q === "string" ? { body: q, asks_starter: true } : q)) as never,
    p_deadline: options.deadlineMs === undefined ? undefined : new Date(Date.now() + options.deadlineMs).toISOString(),
    p_parent_round_id: options.parentRoundId,
  });
  if (error) throw error;
  const { data: qs } = await by.client.from("round_questions").select("id").eq("round_id", data).order("position");
  return { roundId: data, questionIds: (qs ?? []).map((q) => q.id) };
}

/** Answers one question like the app does (save_answers). */
export function answer(by: TestUser, roundId: string, questionId: string, body: string) {
  return by.client.rpc("save_answers", { p_round_id: roundId, p_answers: [{ question_id: questionId, body }] });
}
