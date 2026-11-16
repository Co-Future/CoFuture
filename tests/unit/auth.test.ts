import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/lib/auth/errors";
import { isAuthPath, isProtectedPath } from "@/lib/db/proxy";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation/auth";

describe("signupSchema", () => {
  it("normalizes the email and trims the name", () => {
    const result = signupSchema.parse({ displayName: "  Test Person ", email: " Test@Example.com ", password: "12345678" });
    expect(result).toEqual({ displayName: "Test Person", email: "test@example.com", password: "12345678" });
  });

  it("reports one message per invalid field", () => {
    const result = signupSchema.safeParse({ displayName: " ", email: "kein-at", password: "kurz" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        displayName: "Gib einen Anzeigenamen ein.",
        email: "Gib eine gültige E-Mail-Adresse ein.",
        password: "Das Passwort braucht mindestens 8 Zeichen.",
      });
    }
  });
});

describe("loginSchema", () => {
  it("does not enforce the sign-up password length", () => {
    expect(loginSchema.safeParse({ email: "a@b.de", password: "kurz" }).success).toBe(true);
  });
});

describe("authErrorMessage", () => {
  it("does not reveal whether the email or the password was wrong", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("E-Mail-Adresse oder Passwort stimmen nicht.");
  });

  it("falls back to a generic message", () => {
    expect(authErrorMessage({})).toMatch(/nicht geklappt/);
  });
});

describe("proxy paths", () => {
  it("protects /app and everything below it, but not look-alikes", () => {
    expect(isProtectedPath("/app")).toBe(true);
    expect(isProtectedPath("/app/teams/1")).toBe(true);
    expect(isProtectedPath("/apple")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });

  it("knows the auth pages", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/registrieren")).toBe(true);
    expect(isAuthPath("/app")).toBe(false);
  });
});
