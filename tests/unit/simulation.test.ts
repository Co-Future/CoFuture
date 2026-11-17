import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "@/prompts/v1/perspective-map";
import { liveEvents, random, scenarioProblems, teamOf, teamPeople } from "@/simulation/plan";
import { EMAIL_DOMAIN, emailOf, liveRound, PLAYER, personas, rounds, teams } from "@/simulation/scenario";

/** Checks the office simulation without a network: the database must accept everything it plans. */

describe("office scenario", () => {
  it("is consistent with the database rules", () => {
    expect(scenarioProblems()).toEqual([]);
  });

  it("uses only reserved example addresses", () => {
    expect(EMAIL_DOMAIN.endsWith(".example.com")).toBe(true);
    for (const p of personas) expect(emailOf(p.slug)).toMatch(/^[a-z]+@nordlicht\.example\.com$/);
  });

  it("is big enough to feel like an office", () => {
    expect(personas.length).toBeGreaterThanOrEqual(20);
    expect(teams.length).toBeGreaterThanOrEqual(5);
    expect([...rounds, liveRound].reduce((n, r) => n + r.answers.length, 0)).toBeGreaterThanOrEqual(70);
    expect(personas.filter((p) => p.role === "guest").length).toBeGreaterThanOrEqual(2);
  });

  it("covers every round state and a follow-up round", () => {
    expect(new Set(rounds.map((r) => r.state))).toEqual(new Set(["open", "closed", "decided"]));
    expect(rounds.some((r) => r.parent)).toBe(true);
  });

  it("brings the hard cases for AsyncMeet: voice, irony, a prompt injection, single voices", () => {
    const texts = rounds.flatMap((r) => r.answers);
    expect(texts.some((a) => a.source === "voice")).toBe(true);
    expect(texts.some((a) => /Kaffeeautomat/.test(a.text))).toBe(true);
    expect(texts.some((a) => /Ignoriere alle bisherigen Anweisungen/.test(a.text))).toBe(true);
    expect(texts.some((a) => /alleinerziehend|Teilzeit/.test(a.text))).toBe(true);
  });

  it("keeps the injection inside its response tag", () => {
    const round = rounds.find((r) => r.key === "erp-golive")!;
    const prompt = buildUserPrompt({
      question: round.question,
      context: round.context ?? null,
      responses: round.answers.map((a, i) => ({ id: `A${String(i + 1).padStart(2, "0")}`, text: a.text })),
    });
    expect(prompt.match(/<response /g)).toHaveLength(round.answers.length);
  });

  it("gives the player something to answer and something to decide", () => {
    const mine = rounds.filter((r) => teamPeople(teamOf(r)).includes(PLAYER));
    expect(mine.some((r) => r.state === "open" && !r.answers.some((a) => a.by === PLAYER))).toBe(true);
    expect(mine.some((r) => r.state === "closed" && teamOf(r).lead === PLAYER)).toBe(true);
    // At least one team without the player shows that you only see your own teams.
    expect(teams.some((t) => !teamPeople(t).includes(PLAYER))).toBe(true);
  });
});

describe("live events", () => {
  const duration = 15 * 60_000;
  const events = liveEvents(duration, 42);

  it("plays every held-back answer, revision, read receipt and the live round", () => {
    const expected =
      rounds.reduce((n, r) => n + r.answers.filter((a) => a.live).length + r.answers.filter((a) => a.revised).length + (r.readLive?.length ?? 0), 0) +
      liveRound.answers.length;
    expect(events).toHaveLength(expected);
  });

  it("is sorted and lands answers before the deadline", () => {
    expect(events.map((e) => e.atMs)).toEqual([...events.map((e) => e.atMs)].sort((a, b) => a - b));
    for (const e of events.filter((e) => e.kind !== "read")) expect(e.atMs).toBeLessThanOrEqual(duration * 0.8);
  });

  it("revises an answer only after it exists", () => {
    for (const revise of events.filter((e) => e.kind === "revise")) {
      const original = events.find((e) => e.kind === "answer" && e.round === revise.round && e.by === revise.by);
      if (original) expect(revise.atMs).toBeGreaterThan(original.atMs);
    }
  });

  it("is reproducible from its seed", () => {
    expect(liveEvents(duration, 42)).toEqual(events);
    expect(liveEvents(duration, 7)).not.toEqual(events);
    const a = random(3);
    const b = random(3);
    expect([a(), a()]).toEqual([b(), b()]);
  });
});
