import { CircleCheck, Clock, Gavel, Lock, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddMemberForm } from "@/components/teams/add-member-form";
import { RemoveMemberButton } from "@/components/teams/remove-member-button";
import { Countdown } from "@/components/rounds/countdown";
import { RoundsLiveRefresh } from "@/components/rounds/live-refresh";
import { StatusBadge } from "@/components/rounds/status-badge";
import { buttonStyles } from "@/components/ui/form";
import { RoleBadge } from "@/components/teams/role-badge";
import { TeamDangerZone } from "@/components/teams/team-danger-zone";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { formatDateTime } from "@/lib/format";
import { uuidSchema } from "@/lib/validation/team";

export const metadata: Metadata = { title: "Team – CoFuture" };

async function TeamDetail({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  if (!uuidSchema.safeParse(teamId).success) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: team }, { data: rounds }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id, name, organization_id").eq("id", teamId).maybeSingle(),
    supabase
      .from("rounds")
      .select("id, question, deadline, status")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    supabase.from("team_members").select("user_id, role, profiles(display_name)").eq("team_id", teamId).order("joined_at"),
  ]);
  // RLS returns nothing for teams you are not in.
  if (!team || !members) notFound();

  const isLead = members.some((m) => m.user_id === user.id && m.role === "lead");
  const [{ data: isGuest }, { data: isOrgOwner }, { data: decisions }, { data: ownReads }] = await Promise.all([
    supabase.rpc("is_guest_for_team", { p_team_id: team.id }),
    team.organization_id ? supabase.rpc("is_org_admin", { p_org_id: team.organization_id }) : Promise.resolve({ data: false }),
    // RLS: decisions of exchanges you may see.
    supabase
      .from("decisions")
      .select("id, body, created_at, round_id, rounds(question)")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false }),
    // RLS: only your own read receipts.
    supabase.from("decision_reads").select("decision_id"),
  ]);
  const readIds = new Set((ownReads ?? []).map((r) => r.decision_id));
  const canManage = isLead || Boolean(isOrgOwner);
  // Teams inside an organization: leads pick people from the organization instead of typing an email.
  let candidates: { id: string; name: string }[] | undefined;
  if (isLead && team.organization_id) {
    const { data: orgPeople } = await supabase
      .from("organization_members")
      .select("user_id, profiles(display_name)")
      .eq("organization_id", team.organization_id);
    const inTeam = new Set(members.map((m) => m.user_id));
    candidates = (orgPeople ?? [])
      .filter((p) => !inTeam.has(p.user_id))
      .map((p) => ({ id: p.user_id, name: p.profiles?.display_name ?? "Unbekannt" }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }
  const allRounds = rounds ?? [];
  const openRounds = allRounds.filter((r) => r.status === "open");
  const pastRounds = allRounds.filter((r) => r.status !== "open");
  const stats = [
    { label: "Offen", value: openRounds.length, Icon: Clock },
    { label: "Geschlossen", value: allRounds.filter((r) => r.status === "closed").length, Icon: Lock },
    { label: "Entschieden", value: allRounds.filter((r) => r.status === "decided").length, Icon: CircleCheck },
    { label: "Mitglieder", value: members.length, Icon: Users },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav aria-label="Brotkrumen" className="text-label text-ink-muted">
            <Link href="/app" className="underline hover:text-ink">
              Übersicht
            </Link>
            <span aria-hidden> / </span>
            <span>Team</span>
          </nav>
          <h1 className="text-h1">{team.name}</h1>
        </div>
        {isGuest ? null : (
          <Link href={`/app/teams/${team.id}/runden/neu`} className={buttonStyles.primary}>
            <Plus size={20} strokeWidth={1.75} aria-hidden />
            Austausch starten
          </Link>
        )}
      </div>
      <RoundsLiveRefresh
        filter={{ column: "team_id", value: team.id }}
        openDeadlines={openRounds.flatMap((r) => (r.deadline ? [r.deadline] : []))}
      />

      <section aria-label="Kennzahlen" className="mt-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-lg border border-line bg-card p-4 shadow-card">
              <dt className="flex items-center gap-2 text-body-sm text-ink-muted">
                <Icon size={16} strokeWidth={1.75} aria-hidden />
                {label}
              </dt>
              <dd className="mt-1 font-display text-h1">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="open-heading">
            <h2 id="open-heading" className="mb-4 text-h2">
              Laufender Austausch
            </h2>
            {openRounds.length > 0 ? (
              <RoundList rounds={openRounds} />
            ) : (
              <div className="rounded-lg border border-line bg-card p-4">
                <p className="text-body text-ink-muted">
                  {allRounds.length === 0
                    ? "Noch kein Austausch. Starte den ersten."
                    : "Gerade läuft kein Austausch. Starte einen, wenn es etwas zu klären gibt."}
                </p>
              </div>
            )}
          </section>

          {decisions && decisions.length > 0 ? (
            <section aria-labelledby="decisions-heading">
              <h2 id="decisions-heading" className="mb-4 flex items-center gap-2 text-h2">
                <Gavel aria-hidden size={20} strokeWidth={1.75} />
                Beschlüsse
              </h2>
              <ul className="flex flex-col gap-3">
                {decisions.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/app/runden/${d.round_id}`}
                      className="block rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong"
                    >
                      <p className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                        {formatDateTime(d.created_at)}
                        {readIds.has(d.id) ? null : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                            Neu für dich
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-body font-semibold">{d.body}</p>
                      <p className="mt-1 text-body-sm text-ink-muted">Zum Austausch: {d.rounds?.question}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pastRounds.length > 0 ? (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="mb-4 text-h2">
                Abgeschlossen
              </h2>
              <RoundList rounds={pastRounds} />
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-10">
          <section aria-labelledby="members-heading">
            <h2 id="members-heading" className="mb-4 text-h2">
              Mitglieder ({members.length})
            </h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-card">
              {members.map((member) => {
                const name = member.profiles?.display_name ?? "Unbekannt";
                const isSelf = member.user_id === user.id;
                return (
                  <li key={member.user_id} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-body font-semibold">
                        {name}
                        {isSelf ? <span className="font-normal text-ink-muted"> (du)</span> : null}
                      </span>
                      <RoleBadge role={member.role} />
                    </div>
                    {isSelf || isLead ? (
                      <div>
                        <RemoveMemberButton teamId={team.id} userId={member.user_id} name={name} isSelf={isSelf} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {isLead ? (
            <section aria-labelledby="add-heading">
              <h2 id="add-heading" className="mb-4 text-h3">
                Mitglied hinzufügen
              </h2>
              <AddMemberForm teamId={team.id} candidates={candidates} />
            </section>
          ) : null}

          {canManage ? (
            <TeamDangerZone
              teamId={team.id}
              others={members
                .filter((m) => m.user_id !== user.id)
                .map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? "Unbekannt" }))}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}

type RoundRow = { id: string; question: string; deadline: string | null; status: "open" | "closed" | "decided" };

function RoundList({ rounds }: { rounds: RoundRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rounds.map((round) => (
        <li key={round.id}>
          <Link
            href={`/app/runden/${round.id}`}
            className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong"
          >
            <span className="text-h3">{round.question}</span>
            <span className="flex flex-wrap items-center gap-3 text-body-sm text-ink-muted">
              <StatusBadge status={round.status} />
              {round.deadline ? `Frist: ${formatDateTime(round.deadline)}` : "Ohne Frist"}
              {round.status === "open" && round.deadline ? <Countdown deadline={round.deadline} /> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function TeamPage({ params }: PageProps<"/app/teams/[teamId]">) {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Team wird geladen …</p>}>
      <TeamDetail params={params} />
    </Suspense>
  );
}
