// pnpm sim:setup – builds the office simulation, then checks it from the people's point of view.
import { beforeAll, describe, expect, it } from "vitest";
import { as, hasLlm, log, setup, type SimState } from "./engine";
import { scenarioProblems, teamOf, teamPeople } from "./plan";
import { COMPANY, emailOf, PLAYER, personas, rounds, teams } from "./scenario";

let state: SimState;

beforeAll(async () => {
  expect(scenarioProblems()).toEqual([]);
  state = await setup();
}, 20 * 60_000);

describe(`Simulation „${COMPANY}“`, () => {
  it("everyone sees exactly the teams they are in", async () => {
    for (const person of personas) {
      const { data } = await (await as(person.slug)).from("teams").select("id");
      const expected = teams.filter((t) => teamPeople(t).includes(person.slug)).map((t) => state.teams[t.key]);
      expect(new Set(data?.map((t) => t.id)), person.slug).toEqual(new Set(expected));
    }
  });

  it("guests cannot start rounds", async () => {
    const guest = personas.find((p) => p.role === "guest")!;
    const team = teams.find((t) => t.members.includes(guest.slug))!;
    const { error } = await (await as(guest.slug))
      .from("rounds")
      .insert({ team_id: state.teams[team.key]!, question: "Darf ich das?", deadline: new Date(Date.now() + 3_600_000).toISOString() });
    expect(error).not.toBeNull();
  });

  it("open rounds show the number of answers to all, but never who answered", async () => {
    for (const round of rounds.filter((r) => r.state === "open")) {
      const viewer = await as(teamOf(round).lead);
      const { data: count } = await viewer.rpc("round_response_count", { p_round_id: state.rounds[round.key]! });
      expect(count, round.key).toBe(round.answers.filter((a) => !a.live).length);
      const { data: visible } = await viewer.from("round_responses").select("pseudonym, is_own").eq("round_id", state.rounds[round.key]!);
      expect(visible?.every((r) => r.is_own), round.key).toBe(true);
    }
  });

  it("closed rounds show every answer with a pseudonym, the same for everyone in the team", async () => {
    for (const round of rounds.filter((r) => r.state !== "open")) {
      const views = await Promise.all(
        teamPeople(teamOf(round)).map(async (slug) => {
          const { data } = await (await as(slug)).from("round_responses").select("pseudonym, body").eq("round_id", state.rounds[round.key]!).order("pseudonym");
          return JSON.stringify(data);
        }),
      );
      expect(new Set(views).size, round.key).toBe(1);
      const answers = JSON.parse(views[0]!) as { pseudonym: string }[];
      expect(answers.map((a) => a.pseudonym)).toEqual(round.answers.map((_, i) => `A${String(i + 1).padStart(2, "0")}`));
    }
  });

  it.runIf(hasLlm())("every closed round has a perspective map that covers every answer", async () => {
    for (const round of rounds.filter((r) => r.state !== "open")) {
      const { data } = await (await as(round.by)).from("analyses").select("map").eq("round_id", state.rounds[round.key]!).single();
      const map = data?.map as { clusters: { source_ids: string[] }[] };
      expect(new Set(map.clusters.flatMap((c) => c.source_ids)).size, round.key).toBe(round.answers.length);
    }
  });

  it("decisions are visible to the whole team and nobody outside", async () => {
    for (const round of rounds.filter((r) => r.state === "decided")) {
      const team = teamOf(round);
      for (const person of personas) {
        const { data } = await (await as(person.slug)).from("decisions").select("id").eq("round_id", state.rounds[round.key]!);
        expect(data?.length ?? 0, `${round.key} / ${person.slug}`).toBe(teamPeople(team).includes(person.slug) ? 1 : 0);
      }
    }
  });

  it("prints what is waiting for you", () => {
    const mine = rounds.filter((r) => teamPeople(teamOf(r)).includes(PLAYER));
    log("");
    log(`Fertig. Melde dich an als ${emailOf(PLAYER)} mit SIMULATION_PASSWORD aus .env.local.`);
    log("Wartet auf deine Antwort:");
    for (const r of mine.filter((r) => r.state === "open" && !r.answers.some((a) => a.by === PLAYER))) log(`  - ${r.question}`);
    log("Wartet auf deinen Beschluss:");
    for (const r of mine.filter((r) => r.state === "closed" && (r.by === PLAYER || teamOf(r).lead === PLAYER))) log(`  - ${r.question}`);
    log("Danach: pnpm sim:live, dann antworten die Kolleginnen und Kollegen, während du zuschaust.");
  });
});
