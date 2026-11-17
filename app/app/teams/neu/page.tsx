import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateTeamForm } from "@/components/teams/create-team-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentOrganization } from "@/lib/organizations/current";

export const metadata: Metadata = { title: "Team anlegen – CoFuture" };

async function OrgHint() {
  const user = await getCurrentUser();
  const org = await getCurrentOrganization(user.id);
  if (org?.role === "guest") {
    return (
      <p className="mt-1 mb-6 max-w-[680px] text-body text-ink-muted">
        Als Gast in <span className="font-semibold text-ink">{org.name}</span> kannst du keine Teams anlegen. Frag die Owner der
        Organisation.
      </p>
    );
  }
  return (
    <p className="mt-1 mb-6 max-w-[680px] text-body text-ink-muted">
      {org ? (
        <>
          Das Team gehört zu <span className="font-semibold text-ink">{org.name}</span>. Du wirst seine Leitung und kannst danach
          Personen aus der Organisation hinzufügen.
        </>
      ) : (
        "Du wirst die Leitung des Teams und kannst danach Mitglieder hinzufügen."
      )}
    </p>
  );
}

export default function NewTeamPage() {
  return (
    <>
      <h1 className="text-h1">Team anlegen</h1>
      <Suspense fallback={<div className="mb-6 h-6" />}>
        <OrgHint />
      </Suspense>
      <CreateTeamForm />
    </>
  );
}
