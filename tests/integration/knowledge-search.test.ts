import { beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/db/admin";
import { runEmbedJobs } from "@/lib/jobs/embed";
import { askKnowledge, searchKnowledge } from "@/lib/knowledge/search";
import { setUpTeam, signUp, startExchange, type TestUser } from "./helpers";

/**
 * Hybrid search (step 8b) against staging and the real Gemini embeddings.
 * Made-up texts only (Gemini free tier).
 */
// Answers (8c) use Groq first, to save the Gemini quota.
process.env.LLM_PROVIDER = "groq";

describe("knowledge search", () => {
  const admin = createAdminClient();
  let lead: TestUser;
  let tom: TestUser; // only one asked the targeted question
  let lars: TestUser;
  let outsider: TestUser;
  let orgId: string;
  let teamId: string;
  let otherTeamId: string;

  const saveMap = (roundId: string, clusters: object[], overviews: object[] = []) =>
    admin.from("analyses").upsert(
      {
        round_id: roundId,
        map: { clusters, open_questions: [], overviews } as never,
        provider: "test",
        model: "test",
        prompt_version: "test",
        response_count: 3,
        covered_count: 3,
        duration_ms: 1,
      },
      { onConflict: "round_id" },
    );
  const search = (u: TestUser, query: string, extra: { teamId?: string; org?: string } = {}) =>
    searchKnowledge(u.client, { organizationId: extra.org ?? orgId, query, teamId: extra.teamId });
  const titles = (r: Awaited<ReturnType<typeof search>>) => r.hits.map((h) => h.title);

  beforeAll(async () => {
    [lead, tom, lars, outsider] = await Promise.all([signUp("s-lead"), signUp("s-tom"), signUp("s-lars"), signUp("s-out")]);
    ({ orgId, teamId } = await setUpTeam(lead, [{ user: tom }, { user: lars }], "Suche"));
    otherTeamId = (await lead.client.rpc("create_team", { p_name: "Zweites Team", p_organization_id: orgId })).data!.id;
    await outsider.client.rpc("create_organization", { p_name: "Fremd" });

    const a = await startExchange(lead, teamId, [
      { body: "Sollen wir die Vier-Tage-Woche testen?" },
      { body: "Tom, wie sieht es mit deinem Gehaltswunsch aus?", targets: [tom.userId] },
    ]);
    await saveMap(a.roundId, [
      {
        title: "Hotline-Erreichbarkeit sicherstellen",
        kind: "dissent",
        summary: "Die Kundenhotline muss montags bis freitags besetzt bleiben.",
        source_ids: ["A01", "A02"],
        question_id: a.questionIds[0],
      },
      {
        title: "Mehr Erholung",
        kind: "consensus",
        summary: "Ein freier Tag mehr bringt Erholung und weniger Fehler.",
        source_ids: ["A03"],
        question_id: a.questionIds[0],
      },
      {
        title: "Vertrauliche Gehaltsfrage",
        kind: "single_voice",
        summary: "Tom wünscht sich eine Gehaltsanpassung im Frühjahr.",
        source_ids: ["A02"],
        question_id: a.questionIds[1],
      },
    ]);

    const b = await startExchange(lead, otherTeamId, ["Welche Laptops bestellen wir für das Team?"]);
    await saveMap(b.roundId, [
      {
        title: "Leichtere Geräte",
        kind: "consensus",
        summary: "Viele wünschen sich leichtere Laptops für Dienstreisen.",
        source_ids: ["A01"],
        question_id: b.questionIds[0],
      },
    ]);

    for (let i = 0; i < 5; i++) {
      const { data } = await admin.from("knowledge_items").select("id").eq("organization_id", orgId).is("embedding", null);
      if (!data?.length) break;
      await runEmbedJobs({ limit: 100 });
    }
  }, 120_000);

  it("finds by keyword, with the match marked in the excerpt", async () => {
    const r = await search(lars, "Hotline");
    expect(r.mode).toBe("hybrid");
    expect(titles(r)[0]).toBe("Hotline-Erreichbarkeit sicherstellen");
    expect(r.hits[0].matchedText).toBe(true);
    // Matches in the content are marked in the excerpt (German stemming: "besetzt" finds "besetzt", "Montag" finds "montags").
    const marked = await search(lars, "Montag besetzt");
    expect(marked.hits[0].snippet).toMatch(/\[\[montags\]\].*\[\[besetzt\]\]/);
  });

  it("finds by meaning without a shared word", async () => {
    const r = await search(lars, "Wer kümmert sich um den Kundensupport?");
    expect(titles(r)).toContain("Hotline-Erreichbarkeit sicherstellen");
    const hit = r.hits.find((h) => h.title === "Hotline-Erreichbarkeit sicherstellen")!;
    expect(hit.matchedMeaning).toBe(true);
  });

  it("returns nothing for an unrelated query", async () => {
    expect((await search(lars, "Pizza bestellen")).hits).toEqual([]);
  });

  it("searches across teams of the organization, or within one team", async () => {
    expect(titles(await search(lead, "neue Laptops"))).toContain("Leichtere Geräte");
    expect(titles(await search(lead, "neue Laptops", { teamId }))).not.toContain("Leichtere Geräte");
  });

  it("never finds what you may not see in the original", async () => {
    // Tom and the starter see the targeted question, Lars does not.
    expect(titles(await search(tom, "Gehalt"))).toContain("Vertrauliche Gehaltsfrage");
    expect(titles(await search(lead, "Gehalt"))).toContain("Vertrauliche Gehaltsfrage");
    expect(titles(await search(lars, "Gehalt"))).not.toContain("Vertrauliche Gehaltsfrage");
    // Lars is not in the second team.
    expect(titles(await search(lars, "Laptops"))).not.toContain("Leichtere Geräte");
    // Another organization finds nothing, even with our organization id.
    expect((await search(outsider, "Hotline")).hits).toEqual([]);
  });

  const ask = (u: TestUser, question: string) => askKnowledge(u.client, { organizationId: orgId, question });

  it("answers a question with statements that cite the right sources", async () => {
    const a = await ask(lars, "Muss die Hotline am Freitag besetzt sein?");
    expect(a.statements.length).toBeGreaterThan(0);
    const cited = new Set(a.statements.flatMap((s) => s.sources.map((h) => h.title)));
    expect(cited).toContain("Hotline-Erreichbarkeit sicherstellen");
    for (const s of a.statements) {
      expect(s.sources.length).toBeGreaterThan(0);
      for (const h of s.sources) expect(a.consulted.map((c) => c.id)).toContain(h.id);
    }
  }, 60_000);

  it("says nothing when the store holds nothing on the question, without calling a model", async () => {
    const a = await ask(lars, "Wie hoch ist das Budget für die Weihnachtsfeier?");
    expect(a.statements).toEqual([]);
    expect(a.consulted).toEqual([]);
    expect(a.model).toBeNull();
  });

  it("never answers from items you may not see", async () => {
    const a = await ask(lars, "Was wünscht sich Tom beim Gehalt?");
    expect(a.consulted.map((h) => h.title)).not.toContain("Vertrauliche Gehaltsfrage");
    expect(a.statements.flatMap((s) => s.sources.map((h) => h.title))).not.toContain("Vertrauliche Gehaltsfrage");
  }, 60_000);
});
