import { Hourglass, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AddPersonForm } from "@/components/organizations/add-person-form";
import { OrganizationDangerZone } from "@/components/organizations/organization-danger-zone";
import { OrgRoleBadge } from "@/components/organizations/org-role-badge";
import { PersonActions } from "@/components/organizations/person-actions";
import { WithdrawInvitationButton } from "@/components/organizations/withdraw-invitation-button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { formatDateTime } from "@/lib/format";
import { getCurrentOrganization } from "@/lib/organizations/current";

export const metadata: Metadata = { title: "Organisation – CoFuture" };

async function OrganizationDetail() {
  const user = await getCurrentUser();
  const org = await getCurrentOrganization(user.id);
  if (!org) redirect("/app");
  const isOwner = org.role === "owner";

  const supabase = await createClient();
  const [{ data: people }, { data: teams }, { data: invitations }] = await Promise.all([
    supabase.rpc("organization_people", { p_org_id: org.id }),
    supabase.from("teams").select("id, name").eq("organization_id", org.id).order("name"),
    isOwner ? supabase.rpc("organization_invitations_list", { p_org_id: org.id }) : Promise.resolve({ data: [] }),
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
                    <OrgRoleBadge role={person.role} />
                    {person.pending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-body-sm text-warning-ink">
                        <Hourglass size={16} strokeWidth={1.75} aria-hidden />
                        Zugang noch nicht eingerichtet
                      </span>
                    ) : null}
                  </div>
                  {person.email ? <span className="font-mono text-body-sm text-ink-muted">{person.email}</span> : null}
                  {isOwner && !isSelf ? (
                    <PersonActions
                      organizationId={org.id}
                      userId={person.user_id}
                      name={person.display_name}
                      role={person.role}
                      managed={person.managed}
                      pending={person.pending}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          {isOwner && invitations && invitations.length > 0 ? (
            <section aria-labelledby="invitations-heading" className="mt-10">
              <h2 id="invitations-heading" className="mb-1 text-h2">
                Offene Einladungen ({invitations.length})
              </h2>
              <p className="mb-4 text-body-sm text-ink-muted">
                Diese Personen haben schon ein Konto. Sie treten erst bei, wenn sie die Einladung annehmen.
              </p>
              <ul className="divide-y divide-line rounded-lg border border-line bg-card">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-body font-semibold">{inv.display_name}</span>
                      <OrgRoleBadge role={inv.role} />
                      <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-body-sm text-ink-muted">
                        <Mail size={16} strokeWidth={1.75} aria-hidden />
                        Eingeladen am {formatDateTime(inv.created_at)}
                      </span>
                    </div>
                    <span className="font-mono text-body-sm text-ink-muted">{inv.email}</span>
                    {inv.team_names.length > 0 ? (
                      <span className="text-body-sm">
                        <span className="text-ink-muted">Teams: </span>
                        {inv.team_names.join(", ")}
                      </span>
                    ) : null}
                    <WithdrawInvitationButton organizationId={org.id} invitationId={inv.id} name={inv.display_name} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        <aside className="flex flex-col gap-10">
          {isOwner ? (
            <section aria-labelledby="add-person-heading">
              <h2 id="add-person-heading" className="mb-1 text-h3">
                Person hinzufügen
              </h2>
              <p className="mb-4 text-body-sm text-ink-muted">
                Gibt es noch kein Konto, wird es sofort angelegt und du bekommst einen Zugangslink. Hat die Person schon ein
                Konto, bekommt sie eine Einladung und tritt erst bei, wenn sie annimmt.
              </p>
              <AddPersonForm organizationId={org.id} teams={teams ?? []} />
            </section>
          ) : (
            <p className="text-body-sm text-ink-muted">
              Personen hinzufügen, Rollen vergeben und Zugangslinks erzeugen können die Owner deiner Organisation.
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
              <p className="text-body-sm text-ink-muted">Noch keine Teams. Leg eins über „Team anlegen“ im Menü an.</p>
            )}
          </section>
        </aside>
      </div>

      {isOwner ? (
        <div className="mt-12 max-w-[680px]">
          <OrganizationDangerZone
            organizationId={org.id}
            organizationName={org.name}
            others={(people ?? []).filter((p) => p.user_id !== user.id).map((p) => ({ id: p.user_id, name: p.display_name }))}
          />
        </div>
      ) : null}
    </>
  );
}

export default function OrganizationPage() {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Organisation wird geladen …</p>}>
      <OrganizationDetail />
    </Suspense>
  );
}
