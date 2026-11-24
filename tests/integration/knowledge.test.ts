import { beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/db/admin";
import { EMBEDDING_MARKER } from "@/lib/ai/embed";
import { runEmbedJobs } from "@/lib/jobs/embed";
import { signUp, testRun as run, type TestUser } from "./helpers";

/**
 * Knowledge store (step 8a): summaries, clusters and decisions become items with exactly the
 * visibility of their original. Made-up texts only (they go to the Gemini free tier).
 */
describe("knowledge store", () => {
  const admin = createAdminClient();
  let lead: TestUser; // starts the exchange
  let tom: TestUser; // target of the targeted question
  let lars: TestUser; // in the team, not a target
  let neighbour: TestUser; // same organization, other team
  let outsider: TestUser;
  let teamId: string;
  let roundId: string;
  let qAll: string;
  let qTom: string;

  const items = async (u: TestUser) =>
    (await u.client.from("knowledge_items").select("kind, title, question_id, cluster_kind").eq("round_id", roundId)).data ?? [];
  const map = (summarySuffix = "") => ({
    clusters: [
      {
        title: "Termin passt",
        kind: "consensus",
        summary: `Fast alle können am Donnerstag.${summarySuffix}`,
        source_ids: ["A01", "A02"],
        question_id: qAll,
      },
      {
        title: "Lieber Freitag",
        kind: "single_voice",
        summary: "Eine Person bevorzugt Freitag wegen Kita.",
        source_ids: ["A03"],
        question_id: qAll,
      },
      {
        title: "Nicht zugeordnet",
        kind: "unassigned",
        summary: "Diese Beiträge hat AsyncMeet keinem Thema zugeordnet.",
        source_ids: ["A04"],
        question_id: qAll,
      },
      {
        title: "Support übernommen",
        kind: "consensus",
        summary: "Der Support ist ab Montag geklärt.",
        source_ids: ["A02"],
        question_id: qTom,
      },
    ],
    open_questions: [],
    overviews: [
      { text: "Der Donnerstag passt den meisten, eine Stimme wünscht Freitag.", source_ids: ["A01", "A03"], question_id: qAll },
      { text: "Der Support ist geregelt.", source_ids: ["A02"], question_id: qTom },
    ],
  });
  const saveMap = (m: object) =>
    admin.from("analyses").upsert(
      {
        round_id: roundId,
        map: m as never,
        provider: "test",
        model: "test",
        prompt_version: "v1",
        response_count: 4,
        covered_count: 4,
        duration_ms: 1,
      },
      { onConflict: "round_id" },
    );

  beforeAll(async () => {
    [lead, tom, lars, neighbour, outsider] = await Promise.all([
      signUp("k-lead"),
      signUp("k-tom"),
      signUp("k-lars"),
      signUp("k-neighbour"),
      signUp("k-out"),
    ]);
    const orgId = (await lead.client.rpc("create_organization", { p_name: `Wissen ${run}` })).data!.id;
    await admin.from("organization_members").insert([
      { organization_id: orgId, user_id: tom.userId, role: "member" },
      { organization_id: orgId, user_id: lars.userId, role: "member" },
      { organization_id: orgId, user_id: neighbour.userId, role: "member" },
    ]);
    await outsider.client.rpc("create_organization", { p_name: `Fremd ${run}` });
    teamId = (await lead.client.rpc("create_team", { p_name: `Team ${run}`, p_organization_id: orgId })).data!.id;
    await neighbour.client.rpc("create_team", { p_name: `Nachbar ${run}`, p_organization_id: orgId });
    for (const u of [tom, lars]) await lead.client.rpc("add_team_member", { p_team_id: teamId, p_user_id: u.userId });

    roundId = (
      await lead.client.rpc("create_exchange", {
        p_team_id: teamId,
        p_questions: [
          { body: "Passt der Donnerstag für das Treffen?" },
          { body: "Tom, übernimmst du den Support?", targets: [tom.userId] },
        ] as never,
      })
    ).data!;
    const { data: qs } = await lead.client.from("round_questions").select("id").eq("round_id", roundId).order("position");
    [qAll, qTom] = qs!.map((q) => q.id);
    const { error } = await saveMap(map());
    if (error) throw error;
  });

  it("takes summaries and clusters from the map, without the unassigned bucket", async () => {
    const all = await items(lead);
    expect(all.filter((i) => i.kind === "overview")).toHaveLength(2);
    expect(
      all
        .filter((i) => i.kind === "cluster")
        .map((i) => i.title)
        .sort(),
    ).toEqual(["Lieber Freitag", "Support übernommen", "Termin passt"]);
    expect(all.some((i) => i.title === "Nicht zugeordnet")).toBe(false);
    expect(all.find((i) => i.title === "Lieber Freitag")?.cluster_kind).toBe("single_voice");
  });

  it("items of a targeted question are visible only to its targets and the starter", async () => {
    const forQuestion = async (u: TestUser) => new Set((await items(u)).map((i) => i.question_id));
    expect(await forQuestion(lead)).toEqual(new Set([qAll, qTom]));
    expect(await forQuestion(tom)).toEqual(new Set([qAll, qTom]));
    expect(await forQuestion(lars)).toEqual(new Set([qAll]));
  });

  it("other teams of the organization and outsiders see nothing", async () => {
    expect(await items(neighbour)).toEqual([]);
    expect(await items(outsider)).toEqual([]);
  });

  it("a new map replaces the old items instead of adding to them", async () => {
    await saveMap(map(" Aktualisiert."));
    const all = await items(lead);
    expect(all).toHaveLength(5);
    const { data } = await lead.client
      .from("knowledge_items")
      .select("content")
      .eq("round_id", roundId)
      .eq("title", "Termin passt")
      .single();
    expect(data?.content).toContain("Aktualisiert.");
  });

  it("full-text search works in German right away, before any embedding", async () => {
    const { data } = await lars.client
      .from("knowledge_items")
      .select("title")
      .eq("round_id", roundId)
      .textSearch("search", "Donnerstage", { config: "german", type: "plain" });
    expect(data!.map((d) => d.title)).toEqual(expect.arrayContaining(["Termin passt", "Zusammenfassung"]));
  });

  it("decisions are added with their rationale and visible to the team", async () => {
    await lead.client.from("rounds").update({ status: "closed" }).eq("id", roundId);
    const { error } = await lead.client.rpc("decide_round", {
      p_round_id: roundId,
      p_body: "Das Treffen ist am Donnerstag.",
      p_rationale: "Passt fast allen, die Freitag-Stimme bekommt eine Videoschalte.",
      p_cluster_refs: [0, 1],
    });
    expect(error).toBeNull();
    const { data } = await lars.client
      .from("knowledge_items")
      .select("title, content")
      .eq("round_id", roundId)
      .eq("kind", "decision")
      .single();
    expect(data?.title).toBe("Das Treffen ist am Donnerstag.");
    expect(data?.content).toContain("Begründung: Passt fast allen");
    expect(
      (await neighbour.client.from("knowledge_items").select("id").eq("kind", "decision").eq("round_id", roundId)).data,
    ).toEqual([]);
  });

  it("nobody writes items or claims embedding work from the client", async () => {
    const insert = await lead.client
      .from("knowledge_items")
      .insert({ team_id: teamId, round_id: roundId, kind: "cluster", question: "x", title: "Gefälscht", content: "x" });
    expect(insert.error).not.toBeNull();
    await lead.client.from("knowledge_items").update({ title: "Geändert" }).eq("round_id", roundId);
    await lead.client.from("knowledge_items").delete().eq("round_id", roundId);
    expect(await items(lead)).toHaveLength(6);
    expect((await lead.client.rpc("claim_knowledge_items", { p_limit: 1 })).error).not.toBeNull();
  });

  it("the embedding job adds a 768-dimension vector to every item", async () => {
    // Other runs may have pending items too; loop until ours are done.
    for (let i = 0; i < 5; i++) {
      const { data } = await admin.from("knowledge_items").select("id").eq("round_id", roundId).is("embedding", null);
      if (!data?.length) break;
      await runEmbedJobs({ limit: 100 });
    }
    const { data } = await admin.from("knowledge_items").select("embedding, embedding_model").eq("round_id", roundId);
    expect(data).toHaveLength(6);
    for (const row of data!) {
      expect(row.embedding_model).toBe(EMBEDDING_MARKER);
      expect(JSON.parse(row.embedding as string)).toHaveLength(768);
    }
  }, 60_000);

  it("deleting the exchange removes its items", async () => {
    await admin.from("rounds").delete().eq("id", roundId);
    const { data } = await admin.from("knowledge_items").select("id").eq("round_id", roundId);
    expect(data).toEqual([]);
  });
});
