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
  it("treats the empty team option as no team", () => {
    const result = addPersonSchema.parse({ displayName: "Person A", email: " A@B.de ", teamId: "" });
    expect(result).toEqual({ displayName: "Person A", email: "a@b.de", role: "member", teamId: undefined });
  });

  it("rejects a team id that is not a uuid", () => {
    expect(addPersonSchema.safeParse({ displayName: "A", email: "a@b.de", teamId: "x" }).success).toBe(false);
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
