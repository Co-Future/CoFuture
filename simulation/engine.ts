// Runs the office simulation against the Supabase project in .env.local (staging).
// Every simulated person signs in and acts as a normal user, so RLS and all database rules apply
// exactly as in the app. Only the accounts are created with the secret key (like an owner would).
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";
import { runAnalyzeJobs } from "@/lib/jobs/analyze";
import { liveEvents, teamOf, type LiveEvent } from "./plan";
import { COMPANY, EMAIL_DOMAIN, emailOf, liveRound, personas, rounds, teams, type Round } from "./scenario";

type Db = SupabaseClient<Database>;

export type SimState = {
  createdAt: string;
  orgId: string;
  users: Record<string, string>;
  teams: Record<string, string>;
  rounds: Record<string, string>;
  decisions: Record<string, string>;
};

export const STATE_FILE = "simulation/.state.local.json";
const HOUR = 3_600_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nameOf = (slug: string) => personas.find((p) => p.slug === slug)?.name ?? slug;

export function log(message: string) {
  const time = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date(),
  );
  console.log(`${time}  ${message}`);
}

function settings() {
  const env = publicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  const password = process.env.SIMULATION_PASSWORD;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY fehlt in .env.local.");
  if (!password || password.length < 8) throw new Error("SIMULATION_PASSWORD (mindestens 8 Zeichen) fehlt in .env.local.");
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, secret, password };
}

export const hasLlm = () => Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
let adminClient: Db | null = null;
export function admin(): Db {
  const s = settings();
  adminClient ??= createClient<Database>(s.url, s.secret, options);
  return adminClient;
}

const sessions = new Map<string, Db>();

/** A client signed in as the simulated person. Waits and retries when Auth rate-limits sign-ins. */
export async function as(slug: string): Promise<Db> {
  const cached = sessions.get(slug);
  if (cached) return cached;
  const s = settings();
  const client = createClient<Database>(s.url, s.key, { auth: { persistSession: false, autoRefreshToken: true } });
  for (let attempt = 1; ; attempt++) {
    const { error } = await client.auth.signInWithPassword({ email: emailOf(slug), password: s.password });
    if (!error) break;
    if (error.status !== 429 || attempt >= 6) throw new Error(`Anmeldung als ${slug} fehlgeschlagen: ${error.message}`);
    log(`Zu viele Anmeldungen, warte 30 Sekunden (${nameOf(slug)}) …`);
    await sleep(30_000);
  }
  sessions.set(slug, client);
  return client;
}

function must<R extends { data: unknown; error: { message: string } | null }>(result: R, what: string): NonNullable<R["data"]> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`${what}: ${result.error?.message ?? "keine Daten"}`);
  }
  return result.data as NonNullable<R["data"]>;
}

export function loadState(): SimState {
  if (!existsSync(STATE_FILE)) throw new Error("Keine Simulation gefunden. Zuerst: pnpm sim:setup");
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as SimState;
}
const saveState = (state: SimState) => writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);

/** All accounts of the simulation, found by their reserved e-mail domain. */
async function simulationUsers(): Promise<{ id: string; email: string }[]> {
  const found: { id: string; email: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) if (user.email?.endsWith(`@${EMAIL_DOMAIN}`)) found.push({ id: user.id, email: user.email });
    if (data.users.length < 1000) return found;
  }
}

// ------------------------------------------------------------------------------------------ setup

export async function setup(): Promise<SimState> {
  if ((await simulationUsers()).length > 0) throw new Error("Die Simulation existiert schon. Zuerst: pnpm sim:reset");
  const { password } = settings();
  const state: SimState = { createdAt: new Date().toISOString(), orgId: "", users: {}, teams: {}, rounds: {}, decisions: {} };

  log(`Lege ${personas.length} Personen an …`);
  for (const person of personas) {
    const { data, error } = await admin().auth.admin.createUser({
      email: emailOf(person.slug),
      password,
      email_confirm: true,
      user_metadata: { display_name: person.name },
    });
    if (error || !data.user) throw new Error(`Konto ${person.slug}: ${error?.message}`);
    state.users[person.slug] = data.user.id;
  }
  saveState(state);

  const owner = personas.find((p) => p.role === "owner")!;
  const org = must(await (await as(owner.slug)).rpc("create_organization", { p_name: COMPANY }), "Organisation");
  state.orgId = org.id;
  saveState(state);
  log(`Organisation „${COMPANY}“ angelegt von ${owner.name}.`);

  // Same rows the "Person hinzufügen" route writes: accounts created by the organization.
  const members = personas
    .filter((p) => p.slug !== owner.slug)
    .map((p) => ({ organization_id: org.id, user_id: state.users[p.slug]!, role: p.role, managed: true }));
  must(await admin().from("organization_members").insert(members).select("user_id"), "Mitgliedschaften");

  for (const team of teams) {
    const lead = await as(team.lead);
    const created = must(await lead.rpc("create_team", { p_name: team.name, p_organization_id: org.id }), `Team ${team.key}`);
    state.teams[team.key] = created.id;
    for (const slug of team.members) {
      const result = must(await lead.rpc("add_team_member", { p_team_id: created.id, p_user_id: state.users[slug]! }), `Mitglied ${slug}`);
      if (result !== "added") throw new Error(`Mitglied ${slug} in ${team.key}: ${result}`);
    }
    log(`Team „${team.name}“: ${nameOf(team.lead)} leitet, ${team.members.length} Mitglieder.`);
  }
  saveState(state);

  for (const round of rounds) {
    await playRound(state, round);
    saveState(state);
  }
  return state;
}

async function startRound(state: SimState, round: Round, deadline: Date): Promise<string> {
  const creator = await as(round.by);
  const row = must(
    await creator
      .from("rounds")
      .insert({
        team_id: state.teams[round.team]!,
        created_by: state.users[round.by]!,
        question: round.question,
        context: round.context ?? null,
        deadline: deadline.toISOString(),
        parent_round_id: round.parent ? state.rounds[round.parent]! : null,
      })
      .select("id")
      .single(),
    `Runde ${round.key}`,
  );
  state.rounds[round.key] = row.id;
  return row.id;
}

export async function answer(roundId: string, by: string, text: string, source: "text" | "voice" = "text") {
  const result = await (await as(by)).from("responses").insert({ round_id: roundId, body: text, source }).select("pseudonym").single();
  return must(result, `Antwort ${by}`).pseudonym;
}

/** Starts a round and plays it up to its target state: answers, closing, map, decision, read receipts. */
async function playRound(state: SimState, round: Round) {
  const roundId = await startRound(state, round, new Date(Date.now() + round.deadlineHours * HOUR));
  const now = round.answers.filter((a) => !a.live);
  for (const a of now) await answer(roundId, a.by, a.text, a.source);
  const held = round.answers.length - now.length;
  log(`Runde „${round.question}“ (${teamOf(round).name}): ${now.length} Antworten${held ? `, ${held} folgen live` : ""}.`);
  if (round.state === "open") return;

  must(await (await as(round.by)).from("rounds").update({ status: "closed" }).eq("id", roundId).select("id"), `Schließen ${round.key}`);
  log(`  geschlossen von ${nameOf(round.by)}.`);
  const map = await analyse(round.by, roundId);
  if (round.state !== "decided" || !round.decision) return;

  const clusters = map?.clusters ?? [];
  const refs = round.decision.refKinds.map((kind) => clusters.findIndex((c) => c.kind === kind)).filter((i) => i >= 0);
  const decision = must(
    await (await as(round.by)).rpc("decide_round", {
      p_round_id: roundId,
      p_body: round.decision.body,
      p_rationale: round.decision.rationale,
      p_cluster_refs: refs,
    }),
    `Beschluss ${round.key}`,
  );
  state.decisions[round.key] = decision.id;
  for (const slug of round.readBy ?? []) await confirmRead(decision.id, slug, state);
  log(`  beschlossen von ${nameOf(round.by)}, ${(round.readBy?.length ?? 0) + 1} Lesebestätigungen.`);
}

type MapData = { clusters: { kind: string; source_ids: string[] }[] };

/** Runs the analysis job of the round (what the worker does in production) and returns the map. */
async function analyse(viewer: string, roundId: string): Promise<MapData | null> {
  if (!hasLlm()) {
    log("  Kein GEMINI_API_KEY oder GROQ_API_KEY: Die Perspektivenkarte bleibt in der Warteschlange.");
    return null;
  }
  const run = await runAnalyzeJobs({ limit: 1 });
  const { data } = await (await as(viewer)).from("analyses").select("map").eq("round_id", roundId).maybeSingle();
  const map = (data?.map ?? null) as MapData | null;
  log(map ? `  Perspektivenkarte: ${map.clusters.length} Themen.` : `  Perspektivenkarte fehlgeschlagen (${run.failed} Fehler), neuer Versuch in der App möglich.`);
  return map;
}

async function confirmRead(decisionId: string, slug: string, state: SimState) {
  const { error } = await (await as(slug))
    .from("decision_reads")
    .upsert({ decision_id: decisionId, user_id: state.users[slug]! }, { onConflict: "decision_id,user_id", ignoreDuplicates: true });
  if (error) throw new Error(`Lesebestätigung ${slug}: ${error.message}`);
}

// ------------------------------------------------------------------------------------------- live

/**
 * Colleagues keep working while you use the app: held-back answers arrive, people revise answers,
 * read receipts come in, and a short live round runs to its deadline. pg_cron closes it; this loop
 * then does the worker's job and builds the perspective map.
 */
export async function live(minutes: number, seed = Date.now()) {
  const state = loadState();
  const durationMs = Math.max(2, minutes) * 60_000;
  const start = Date.now();
  const liveId = await startRound(state, liveRound, new Date(start + durationMs));
  saveState(state);
  log(`Live-Simulation läuft ${minutes} Minuten. Neue Runde „${liveRound.question}“ im Team ${teamOf(liveRound).name}.`);
  log("Öffne die App, melde dich als alex@" + EMAIL_DOMAIN + " an und schau zu. Abbrechen mit Strg+C.");

  let lastWorker = 0;
  for (const event of liveEvents(durationMs, seed)) {
    while (Date.now() - start < event.atMs) {
      await sleep(Math.min(5_000, event.atMs - (Date.now() - start)));
      if (Date.now() - lastWorker > 30_000) lastWorker = await worker();
    }
    await play(state, event).catch((error: unknown) => log(`  übersprungen: ${String(error)}`));
  }

  log("Alle Ereignisse gespielt. Warte, bis pg_cron die Live-Runde schließt …");
  while (Date.now() < start + durationMs + 3 * 60_000) {
    const { data } = await admin().from("rounds").select("status").eq("id", liveId).single();
    if (data?.status !== "open") break;
    await sleep(10_000);
  }
  await worker();
  const { data } = await admin().from("analyses").select("id").eq("round_id", liveId).maybeSingle();
  log(data ? "Live-Runde geschlossen, die Perspektivenkarte ist da." : "Live-Runde ohne Karte beendet (kein KI-Schlüssel oder Runde noch offen).");
}

async function play(state: SimState, event: LiveEvent) {
  const roundId = state.rounds[event.round];
  if (!roundId) throw new Error(`Runde ${event.round} fehlt`);
  const question = [...rounds, liveRound].find((r) => r.key === event.round)!.question;
  if (event.kind === "answer") {
    const pseudonym = await answer(roundId, event.by, event.text, event.source);
    log(`${nameOf(event.by)} antwortet${event.source === "voice" ? " per Sprache" : ""} auf „${question}“ (${pseudonym}).`);
  } else if (event.kind === "revise") {
    must(
      await (await as(event.by)).from("responses").update({ body: event.text }).eq("round_id", roundId).select("id"),
      `Änderung ${event.by}`,
    );
    log(`${nameOf(event.by)} ändert die eigene Antwort auf „${question}“.`);
  } else {
    const decisionId = state.decisions[event.round];
    if (!decisionId) throw new Error(`Kein Beschluss zu ${event.round}`);
    await confirmRead(decisionId, event.by, state);
    log(`${nameOf(event.by)} bestätigt den Beschluss zu „${question}“.`);
  }
}

/** One worker pass for analysis jobs, as /api/worker would do. Returns the time of the run. */
async function worker(): Promise<number> {
  if (hasLlm()) {
    const run = await runAnalyzeJobs({ limit: 2 }).catch(() => ({ processed: 0, done: 0, failed: 0 }));
    if (run.processed > 0) log(`Worker: ${run.done} Perspektivenkarte(n) erstellt, ${run.failed} fehlgeschlagen.`);
  }
  return Date.now();
}

// ------------------------------------------------------------------------------------------ reset

/** Deletes the organization (teams, rounds, answers, decisions follow) and every simulated account. */
export async function reset(): Promise<number> {
  const users = await simulationUsers();
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    const { error } = await admin().from("organizations").delete().in("created_by", ids);
    if (error) throw new Error(`Organisation löschen: ${error.message}`);
  }
  for (const user of users) {
    const { error } = await admin().auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Konto ${user.email} löschen: ${error.message}`);
  }
  rmSync(STATE_FILE, { force: true });
  return users.length;
}
