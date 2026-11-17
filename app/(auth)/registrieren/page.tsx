import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Organisation anlegen – CoFuture" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-h2">Organisation anlegen</h1>
      <p className="mt-2 mb-6 text-body text-ink-muted">Leg deine Organisation an. Danach fügst du Personen hinzu und schickst ihnen ihren Zugangslink.</p>
      <AuthForm mode="signup" />
    </>
  );
}
