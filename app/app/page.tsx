import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = { title: "Übersicht – CoFuture" };

async function TeamList() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: teams, error } = await supabase.from("teams").select("id, name").order("name");

  if (error) {
    return (
      <p role="alert" className="text-body text-danger-ink">
        Fehler: Deine Teams konnten nicht geladen werden. Lade die Seite neu.
      </p>
    );
  }
  if (teams.length === 0) {
    return <p className="text-body text-ink-muted">Du bist noch in keinem Team.</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {teams.map((team) => (
        <li key={team.id} className="rounded-lg border border-line bg-card p-4 shadow-card">
          <h3 className="text-h3">{team.name}</h3>
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
    </>
  );
}
