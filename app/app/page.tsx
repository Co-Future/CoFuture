import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreateTeamForm } from "@/components/teams/create-team-form";
import { RoleBadge } from "@/components/teams/role-badge";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";

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

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-h1">Übersicht</h1>
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
