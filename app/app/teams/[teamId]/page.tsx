import { ArrowLeft, CircleCheck, Clock, Lock, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddMemberForm } from "@/components/teams/add-member-form";
import { PlannedFeatures } from "@/components/teams/planned-features";
import { RemoveMemberButton } from "@/components/teams/remove-member-button";
import { Countdown } from "@/components/rounds/countdown";
import { RoundsLiveRefresh } from "@/components/rounds/live-refresh";
import { StatusBadge } from "@/components/rounds/status-badge";
import { buttonStyles } from "@/components/ui/form";
import { RoleBadge } from "@/components/teams/role-badge";
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
    supabase.from("teams").select("id, name").eq("id", teamId).maybeSingle(),
    supabase
      .from("rounds")
      .select("id, question, deadline, status")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("user_id, role, profiles(display_name)")
      .eq("team_id", teamId)
      .order("joined_at"),
  ]);
  // RLS returns nothing for teams you are not in.
  if (!team || !members) notFound();

  const isLead = members.some((m) => m.user_id === user.id && m.role === "lead");
  const allRounds = rounds ?? [];
  const openRounds = allRounds.filter((r) => r.status === "open");
  const pastRounds = allRounds.filter((r) => r.status !== "open");
  const stats = [
    { label: "Offene Runden", value: openRounds.length, Icon: Clock },
    { label: "Geschlossen", value: allRounds.filter((r) => r.status === "closed").length, Icon: Lock },
    { label: "Entschieden", value: allRounds.filter((r) => r.status === "decided").length, Icon: CircleCheck },
    { label: "Mitglieder", value: members.length, Icon: Users },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label text-ink-muted">Team</p>
          <h1 className="text-h1">{team.name}</h1>
        </div>
        <Link href={`/app/teams/${team.id}/runden/neu`} className={buttonStyles.primary}>
          <Plus size={20} strokeWidth={1.75} aria-hidden />
          Runde starten
        </Link>
      </div>
      <RoundsLiveRefresh
        filter={{ column: "team_id", value: team.id }}
        openDeadlines={openRounds.map((r) => r.deadline)}
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
              Laufende Runden
            </h2>
            {openRounds.length > 0 ? (
              <RoundList rounds={openRounds} />
            ) : (
              <div className="rounded-lg border border-line bg-card p-4">
                <p className="text-body text-ink-muted">
                  {allRounds.length === 0
                    ? "Noch keine Runden. Starte die erste."
                    : "Gerade läuft keine Runde. Starte eine neue, wenn es etwas zu klären gibt."}
                </p>
              </div>
            )}
          </section>

          {pastRounds.length > 0 ? (
            <section aria-labelledby="past-heading">
              <h2 id="past-heading" className="mb-4 text-h2">
                Abgeschlossene Runden
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
              <AddMemberForm teamId={team.id} />
            </section>
          ) : null}
        </aside>
      </div>

      <div className="mt-12">
        <PlannedFeatures />
      </div>
    </>
  );
}

type RoundRow = { id: string; question: string; deadline: string; status: "open" | "closed" | "decided" };

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
              Frist: {formatDateTime(round.deadline)}
              {round.status === "open" ? <Countdown deadline={round.deadline} /> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function TeamPage({ params }: PageProps<"/app/teams/[teamId]">) {
  return (
    <>
      <Link href="/app" className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline">
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zur Übersicht
      </Link>
      <Suspense fallback={<p className="text-body text-ink-muted">Team wird geladen …</p>}>
        <TeamDetail params={params} />
      </Suspense>
    </>
  );
}
