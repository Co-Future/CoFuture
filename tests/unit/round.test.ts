import { describe, expect, it } from "vitest";
import { formatDateTime, isPast } from "@/lib/format";
import { createRoundSchema, responseSchema } from "@/lib/validation/round";

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe("createRoundSchema", () => {
  it("accepts a valid round and drops an empty context", () => {
    const result = createRoundSchema.parse({ question: " Testen wir das? ", context: "  ", deadline: inDays(3) });
    expect(result.question).toBe("Testen wir das?");
    expect(result.context).toBeUndefined();
  });

  it("rejects deadlines in the past or too far ahead", () => {
    expect(createRoundSchema.safeParse({ question: "Frage?", deadline: inDays(-1) }).success).toBe(false);
    expect(createRoundSchema.safeParse({ question: "Frage?", deadline: inDays(61) }).success).toBe(false);
  });

  it("asks for a deadline when it is missing", () => {
    const result = createRoundSchema.safeParse({ question: "Frage?", deadline: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Wähle eine Frist.");
  });
});

describe("responseSchema", () => {
  it("rejects whitespace-only answers", () => {
    expect(responseSchema.safeParse({ body: "   " }).success).toBe(false);
  });
});

describe("formatDateTime", () => {
  it("formats in German time with the 'Uhr' suffix", () => {
    expect(formatDateTime("2026-11-17T11:00:00Z")).toBe("17.11.2026, 12:00 Uhr");
    expect(formatDateTime("2026-07-01T10:30:00Z")).toBe("01.07.2026, 12:30 Uhr");
  });
});

describe("isPast", () => {
  it("compares against now", () => {
    expect(isPast(inDays(-1))).toBe(true);
    expect(isPast(inDays(1))).toBe(false);
  });
});
