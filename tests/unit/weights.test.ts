import { describe, expect, it } from "vitest";
import { participationLabel, weightLabel, weightOf } from "@/lib/exchange/weights";

describe("weightOf", () => {
  it("counts only ids that answered this question, each once", () => {
    expect(weightOf(["A01", "A02", "A02", "A09"], ["A01", "A02", "A03"])).toEqual({ count: 2, answered: 3, percent: 67 });
  });

  it("is zero without answers", () => {
    expect(weightOf(["A01"], [])).toEqual({ count: 0, answered: 0, percent: 0 });
  });
});

describe("labels", () => {
  it("writes the weight in German", () => {
    expect(weightLabel({ count: 5, answered: 8, percent: 63 })).toBe("5 von 8 Antworten · 63 %");
    expect(weightLabel({ count: 1, answered: 1, percent: 100 })).toBe("1 von 1 Antwort · 100 %");
  });

  it("shows how many of those asked answered", () => {
    expect(participationLabel(6, 8)).toBe("6 von 8 Gefragten haben geantwortet");
    expect(participationLabel(1, 1)).toBe("1 von 1 Gefragten hat geantwortet");
    expect(participationLabel(2, 0)).toBe("2 Antworten");
  });
});
