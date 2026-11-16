import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Konto anlegen – CoFuture" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-h2">Konto anlegen</h1>
      <p className="mt-2 mb-6 text-body text-ink-muted">Mit einem Konto kannst du Teams beitreten und auf Runden antworten.</p>
      <AuthForm mode="signup" />
    </>
  );
}
