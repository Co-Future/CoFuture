import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Anmelden – CoFuture" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-h2">Anmelden</h1>
      <p className="mt-2 mb-6 text-body text-ink-muted">Melde dich an, um deine Teams und Runden zu sehen.</p>
      <AuthForm mode="login" />
    </>
  );
}
