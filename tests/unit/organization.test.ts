import { describe, expect, it } from "vitest";
import { hashToken } from "@/lib/organizations/invite-token";
import {
  acceptInviteSchema,
  addPersonSchema,
  newPasswordSchema,
  organizationSignupSchema,
  setRoleSchema,
} from "@/lib/validation/organization";

const token = "a".repeat(43);

describe("organizationSignupSchema", () => {
  it("needs an organization name on top of the normal sign-up", () => {
    const result = organizationSignupSchema.safeParse({ displayName: "Test", email: "a@b.de", password: "12345678" });
    expect(result.success).toBe(false);
    const ok = organizationSignupSchema.parse({
      organizationName: "  Testverein ",
      displayName: "Test",
      email: "a@b.de",
      password: "12345678",
    });
    expect(ok.organizationName).toBe("Testverein");
  });
});

describe("addPersonSchema", () => {
  const a = "3f0c2b1e-8a4d-4c6b-9e2f-1a2b3c4d5e6f";
  const b = "7d9e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f2a";

  it("defaults to member without teams", () => {
    const result = addPersonSchema.parse({ displayName: "Person A", email: " A@B.de " });
    expect(result).toEqual({ displayName: "Person A", email: "a@b.de", role: "member", teamIds: [] });
  });

  it("takes several teams and drops duplicates", () => {
    expect(addPersonSchema.parse({ displayName: "A", email: "a@b.de", teamIds: [a, b, a] }).teamIds).toEqual([a, b]);
  });

  it("rejects a team id that is not a uuid", () => {
    expect(addPersonSchema.safeParse({ displayName: "A", email: "a@b.de", teamIds: ["x"] }).success).toBe(false);
  });
});

describe("newPasswordSchema", () => {
  it("reports a mismatch on the repeat field", () => {
    const result = newPasswordSchema.safeParse({ password: "12345678", passwordRepeat: "87654321" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["passwordRepeat"]);
  });
});

describe("access tokens", () => {
  it("accepts only 43-character base64url tokens", () => {
    expect(acceptInviteSchema.safeParse({ token, password: "12345678" }).success).toBe(true);
    expect(acceptInviteSchema.safeParse({ token: "kurz", password: "12345678" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token: `${"a".repeat(42)}/`, password: "12345678" }).success).toBe(false);
  });

  it("stores a stable hash, never the token", () => {
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("roles", () => {
  it("knows owner, member and guest only", () => {
    expect(setRoleSchema.safeParse({ role: "guest" }).success).toBe(true);
    expect(setRoleSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(addPersonSchema.parse({ displayName: "A", email: "a@b.de", role: "owner" }).role).toBe("owner");
  });
});
