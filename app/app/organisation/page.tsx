import { ArrowLeft, Hourglass, ShieldCheck, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddPersonForm } from "@/components/organizations/add-person-form";
import { PersonActions } from "@/components/organizations/person-actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { getCurrentOrganization } from "@/lib/organizations/current";

export const metadata: Metadata = { title: "Organisation – CoFuture" };

async function OrganizationDetail() {
  const user = await getCurrentUser();
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect("/app");
  const isAdmin = org.role === "admin";

  const supabase = await createClient();
  const [{ data: people }, { data: teams }] = await Promise.all([
    supabase.rpc("organization_people", { p_org_id: org.id }),
    supabase.from("teams").select("id, name").eq("organization_id", org.id).order("name"),
  ]);

  return (
    <>
      <p className="text-label text-ink-muted">Organisation</p>
      <h1 className="text-h1">{org.name}</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="people-heading">
          <h2 id="people-heading" className="mb-4 text-h2">
            Personen ({people?.length ?? 0})
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-card">
            {(people ?? []).map((person) => {
              const isSelf = person.user_id === user.id;
              return (
                <li key={person.user_id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-body font-semibold">
                      {person.display_name}
                      {isSelf ? <span className="font-normal text-ink-muted"> (du)</span> : null}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-body-sm text-ink-muted">
                      {person.role === "admin" ? (
                        <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
                      ) : (
                        <User size={16} strokeWidth={1.75} aria-hidden />
                      )}
                      {person.role === "admin" ? "Admin" : "Mitglied"}
                    </span>
                    {person.pending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-body-sm text-warning-ink">
                        <Hourglass size={16} strokeWidth={1.75} aria-hidden />
                        Zugang noch nicht eingerichtet
                      </span>
                    ) : null}
                  </div>
                  {person.email ? <span className="font-mono text-body-sm text-ink-muted">{person.email}</span> : null}
                  {isAdmin && !isSelf ? (
                    <PersonActions organizationId={org.id} userId={person.user_id} name={person.display_name} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="flex flex-col gap-10">
          {isAdmin ? (
            <section aria-labelledby="add-person-heading">
              <h2 id="add-person-heading" className="mb-1 text-h3">
                Person hinzufügen
              </h2>
              <p className="mb-4 text-body-sm text-ink-muted">
                Das Konto wird sofort angelegt. Du bekommst einen Zugangslink, mit dem die Person ihr Passwort festlegt.
              </p>
              <AddPersonForm organizationId={org.id} teams={teams ?? []} />
            </section>
          ) : (
            <p className="text-body-sm text-ink-muted">
              Personen hinzufügen und Zugangslinks erzeugen können die Admins deiner Organisation.
            </p>
          )}

          <section aria-labelledby="org-teams-heading">
            <h2 id="org-teams-heading" className="mb-4 text-h3">
              Teams ({teams?.length ?? 0})
            </h2>
            {teams && teams.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {teams.map((team) => (
                  <li key={team.id}>
                    <Link href={`/app/teams/${team.id}`} className="text-body text-primary underline">
                      {team.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-ink-muted">Noch keine Teams. Leg eins in der Übersicht an.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

export default function OrganizationPage() {
  return (
    <>
      <Link href="/app" className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline">
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zur Übersicht
      </Link>
      <Suspense fallback={<p className="text-body text-ink-muted">Organisation wird geladen …</p>}>
        <OrganizationDetail />
      </Suspense>
    </>
  );
}
