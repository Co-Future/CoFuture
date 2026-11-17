import { describe, expect, it } from "vitest";
import { apiError, readJson } from "@/lib/api/respond";
import { createTeamSchema } from "@/lib/validation/team";

const req = (body: string) => new Request("http://x/api", { method: "POST", body });

describe("apiError", () => {
  it("uses the uniform error format", async () => {
    const res = apiError(409, "already_member", "Schon im Team.");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: "already_member", message: "Schon im Team." } });
  });
});

describe("readJson", () => {
  it("returns validated, trimmed data", async () => {
    expect(await readJson(req('{"name":"  Vertrieb "}'), createTeamSchema)).toEqual({ data: { name: "Vertrieb" } });
  });

  it("rejects broken JSON with 400", async () => {
    const result = await readJson(req("{kaputt"), createTeamSchema);
    expect("response" in result && result.response.status).toBe(400);
  });

  it("returns field errors for invalid input", async () => {
    const result = await readJson(req('{"name":""}'), createTeamSchema);
    if (!("response" in result)) throw new Error("expected an error response");
    expect(await result.response.json()).toEqual({
      error: { code: "validation_failed", message: "Bitte prüf deine Eingaben.", fields: { name: "Gib einen Teamnamen ein." } },
    });
  });
});
