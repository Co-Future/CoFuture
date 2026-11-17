import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SetPasswordForm } from "@/components/organizations/set-password-form";
import { createAdminClient } from "@/lib/db/admin";
import { findValidInvite } from "@/lib/organizations/invite-token";
import { inviteTokenSchema } from "@/lib/validation/organization";

// The token is in the URL: never send it to other sites as a referrer.
export const metadata: Metadata = { title: "Zugang einrichten – CoFuture", referrer: "no-referrer" };

async function AccessSetup({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const invite = inviteTokenSchema.safeParse(token).success ? await findValidInvite(createAdminClient(), token) : null;

  if (!invite) {
    return (
      <>
        <h1 className="text-h2">Link nicht mehr gültig</h1>
        <p className="mt-2 text-body text-ink-muted">
          Dieser Zugangslink ist abgelaufen oder wurde schon benutzt. Jeder Link gilt 72 Stunden und nur einmal. Bitte frag
          die Admins deiner Organisation nach einem neuen Link.
        </p>
        <p className="mt-6 text-body-sm text-ink-muted">
          Du hast schon ein Passwort?{" "}
          <Link href="/login" className="font-semibold text-primary underline">
            Anmelden
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-h2">Willkommen, {invite.displayName}</h1>
      <p className="mt-2 mb-6 text-body text-ink-muted">
        Du wurdest zu <span className="font-semibold text-ink">{invite.organizationName}</span> hinzugefügt. Leg jetzt dein
        Passwort fest. Danach meldest du dich mit <span className="font-semibold text-ink">{invite.email}</span> an.
      </p>
      <SetPasswordForm token={token} />
    </>
  );
}

export default function AccessPage({ params }: PageProps<"/zugang/[token]">) {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Zugangslink wird geprüft …</p>}>
      <AccessSetup params={params} />
    </Suspense>
  );
}
