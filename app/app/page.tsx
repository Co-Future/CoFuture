import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import { CreateTeamForm } from "@/components/teams/create-team-form";
import { RoleBadge } from "@/components/teams/role-badge";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { getCurrentOrganization } from "@/lib/organizations/current";

export const metadata: Metadata = { title: "Übersicht – CoFuture" };

async function TeamList() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, team_members!inner(role)")
    .eq("team_members.user_id", user.id)
    .order("name");

  if (error) {
    return (
      <p role="alert" className="text-body text-danger-ink">
        Fehler: Deine Teams konnten nicht geladen werden. Lade die Seite neu.
      </p>
    );
  }
  if (teams.length === 0) {
    return <p className="text-body text-ink-muted">Du bist noch in keinem Team. Leg eins an oder lass dich hinzufügen.</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {teams.map((team) => (
        <li key={team.id}>
          <Link
            href={`/app/teams/${team.id}`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong"
          >
            <span className="text-h3">{team.name}</span>
            <RoleBadge role={team.team_members[0]?.role ?? "member"} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function OrganizationBanner() {
  const user = await getCurrentUser();
  const org = await getCurrentOrganization(user.id);
  if (!org) {
    return (
      <section aria-labelledby="org-heading" className="mt-6 rounded-lg border border-line bg-card p-4 shadow-card">
        <h2 id="org-heading" className="text-h3">
          Noch keine Organisation
        </h2>
        <p className="mt-1 mb-4 text-body-sm text-ink-muted">
          Leg eine Organisation an. Dann kannst du Personen hinzufügen und ihnen einen Zugangslink schicken.
        </p>
        <CreateOrganizationForm />
      </section>
    );
  }
  return (
    <Link
      href="/app/organisation"
      className="mt-6 flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong"
    >
      <span className="flex items-center gap-2 text-h3">
        <Building2 size={20} strokeWidth={1.75} aria-hidden />
        {org.name}
      </span>
      <span className="text-body-sm text-primary underline">
        {org.role === "admin" ? "Personen und Zugänge verwalten" : "Personen ansehen"}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-h1">Übersicht</h1>
      <Suspense fallback={null}>
        <OrganizationBanner />
      </Suspense>
      <section aria-labelledby="teams-heading" className="mt-8">
        <h2 id="teams-heading" className="mb-4 text-h2">
          Deine Teams
        </h2>
        <Suspense fallback={<p className="text-body text-ink-muted">Teams werden geladen …</p>}>
          <TeamList />
        </Suspense>
      </section>
      <section aria-labelledby="new-team-heading" className="mt-10">
        <h2 id="new-team-heading" className="mb-4 text-h3">
          Neues Team
        </h2>
        <CreateTeamForm />
      </section>
    </>
  );
}
