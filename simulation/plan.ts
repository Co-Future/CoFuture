// Pure planning logic for the office simulation: checks the scenario and schedules live events.
// No network, no database: covered by tests/unit/simulation.test.ts.
import { decisionSchema } from "@/lib/validation/decision";
import { responseSchema } from "@/lib/validation/round";
import { liveRound, personas, rounds, teams, type Round, type Team } from "./scenario";

export function teamOf(round: Round): Team {
  const team = teams.find((t) => t.key === round.team);
  if (!team) throw new Error(`Unknown team ${round.team}`);
  return team;
}

export const teamPeople = (team: Team) => [team.lead, ...team.members];

/** Everything the database would refuse, found before anything is written. Empty means the scenario is sound. */
export function scenarioProblems(): string[] {
  const problems: string[] = [];
  const slugs = new Set(personas.map((p) => p.slug));
  const roleOf = (slug: string) => personas.find((p) => p.slug === slug)?.role;
  const keys = new Set<string>();

  if (personas.filter((p) => p.role === "owner").length !== 1) problems.push("Es braucht genau eine Owner-Person.");
  if (slugs.size !== personas.length) problems.push("Doppelte Personen-Kürzel.");

  for (const team of teams) {
    for (const slug of teamPeople(team)) if (!slugs.has(slug)) problems.push(`${team.key}: unbekannte Person ${slug}`);
    if (roleOf(team.lead) === "guest") problems.push(`${team.key}: Gäste können kein Team leiten.`);
    if (new Set(teamPeople(team)).size !== teamPeople(team).length) problems.push(`${team.key}: Person doppelt im Team.`);
  }

  for (const round of [...rounds, liveRound]) {
    const where = round.key;
    if (keys.has(where)) problems.push(`${where}: Schlüssel doppelt.`);
    keys.add(where);
    const team = teams.find((t) => t.key === round.team);
    if (!team) {
      problems.push(`${where}: unbekanntes Team ${round.team}`);
      continue;
    }
    const people = new Set(teamPeople(team));
    if (!people.has(round.by)) problems.push(`${where}: ${round.by} ist nicht im Team.`);
    if (roleOf(round.by) === "guest") problems.push(`${where}: Gäste starten keine Runden.`);
    if (round.question.length < 3 || round.question.length > 500) problems.push(`${where}: Frage hat eine ungültige Länge.`);
    if ((round.context?.length ?? 0) > 4000) problems.push(`${where}: Kontext ist zu lang.`);

    const authors = round.answers.map((a) => a.by);
    if (new Set(authors).size !== authors.length) problems.push(`${where}: Eine Person antwortet zweimal.`);
    for (const answer of round.answers) {
      if (!people.has(answer.by)) problems.push(`${where}: ${answer.by} ist nicht im Team.`);
      for (const text of [answer.text, answer.revised].filter((t): t is string => t !== undefined)) {
        if (!responseSchema.safeParse({ body: text }).success) problems.push(`${where}: Antwort von ${answer.by} ist ungültig.`);
      }
      if (round.state !== "open" && (answer.live || answer.revised)) {
        problems.push(`${where}: Live-Antworten gehen nur in offenen Runden.`);
      }
    }

    if (round.state !== "open" && round.answers.length === 0) problems.push(`${where}: Geschlossene Runden brauchen Antworten.`);
    if (round.state === "decided") {
      if (!round.decision || !decisionSchema.safeParse(round.decision).success) problems.push(`${where}: Beschluss fehlt oder ist ungültig.`);
      if (team.lead !== round.by) problems.push(`${where}: Beschließen kann hier nur die Teamleitung (${team.lead}).`);
    } else if (round.decision) {
      problems.push(`${where}: Beschluss nur bei Zustand "decided".`);
    }
    for (const slug of [...(round.readBy ?? []), ...(round.readLive ?? [])]) {
      if (!people.has(slug)) problems.push(`${where}: ${slug} kann den Beschluss nicht lesen.`);
    }

    if (round.parent) {
      const index = rounds.findIndex((r) => r.key === round.parent);
      const parent = rounds[index];
      if (!parent) problems.push(`${where}: Ursprungsrunde ${round.parent} fehlt.`);
      else {
        if (parent.team !== round.team) problems.push(`${where}: Ursprungsrunde liegt in einem anderen Team.`);
        if (parent.state === "open") problems.push(`${where}: Ursprungsrunde ist noch offen.`);
        if (index > rounds.indexOf(round)) problems.push(`${where}: Ursprungsrunde muss vorher stehen.`);
      }
    }
  }
  return problems;
}

export type LiveEvent =
  | { atMs: number; kind: "answer"; round: string; by: string; text: string; source: "text" | "voice" }
  | { atMs: number; kind: "revise"; round: string; by: string; text: string }
  | { atMs: number; kind: "read"; round: string; by: string };

/** Small deterministic random generator, so a live run is reproducible from its seed. */
export function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Spreads the live events over the run: held-back answers, read receipts and the short live round.
 * Answers land in the first 80 % so they arrive before the deadline; revisions come after the
 * original answer; read receipts trickle in throughout.
 */
export function liveEvents(durationMs: number, seed = 1): LiveEvent[] {
  const rand = random(seed);
  const window = durationMs * 0.8;
  const at = (from = 0, to = window) => Math.round(from + rand() * (to - from));
  const events: LiveEvent[] = [];

  for (const round of [...rounds, liveRound]) {
    for (const answer of round.answers) {
      const isLiveRound = round === liveRound;
      if (!isLiveRound && !answer.live && !answer.revised) continue;
      const answerAt = isLiveRound || answer.live ? at() : -1;
      if (answerAt >= 0) {
        events.push({ atMs: answerAt, kind: "answer", round: round.key, by: answer.by, text: answer.text, source: answer.source ?? "text" });
      }
      if (answer.revised) {
        events.push({ atMs: at(Math.max(answerAt, 0) + 1, window), kind: "revise", round: round.key, by: answer.by, text: answer.revised });
      }
    }
    for (const by of round.readLive ?? []) events.push({ atMs: at(0, durationMs), kind: "read", round: round.key, by });
  }
  return events.sort((a, b) => a.atMs - b.atMs);
}
