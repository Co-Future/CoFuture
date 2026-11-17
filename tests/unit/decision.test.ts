import { describe, expect, it } from "vitest";
import { decisionSchema } from "@/lib/validation/decision";
import { createRoundSchema } from "@/lib/validation/round";

describe("decisionSchema", () => {
  it("trims texts and deduplicates cluster references", () => {
    const parsed = decisionSchema.parse({ body: "  Wir testen.  ", rationale: " Weil. ", clusterRefs: [2, 0, 2] });
    expect(parsed).toEqual({ body: "Wir testen.", rationale: "Weil.", clusterRefs: [0, 2] });
  });

  it("requires a rationale", () => {
    const result = decisionSchema.safeParse({ body: "Wir testen.", rationale: " " });
    expect(result.success).toBe(false);
  });

  it("defaults to no cluster references", () => {
    expect(decisionSchema.parse({ body: "Wir testen.", rationale: "Weil es passt." }).clusterRefs).toEqual([]);
  });
});

describe("follow-up rounds", () => {
  const base = { question: "Wie klären wir die Hotline?", deadline: new Date(Date.now() + 86_400_000).toISOString() };

  it("accepts an origin round id", () => {
    const id = crypto.randomUUID();
    expect(createRoundSchema.parse({ ...base, parentRoundId: id }).parentRoundId).toBe(id);
  });

  it("rejects anything that is not a uuid", () => {
    expect(createRoundSchema.safeParse({ ...base, parentRoundId: "abc" }).success).toBe(false);
  });
});
