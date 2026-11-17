import { ArrowRight, CircleCheck, Clock, Gavel, Inbox, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Countdown } from "@/components/rounds/countdown";
import { StatusBadge } from "@/components/rounds/status-badge";
import { RoleBadge } from "@/components/teams/role-badge";
import { buttonStyles } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { formatDateTime } from "@/lib/format";
import { getCurrentOrganization } from "@/lib/organizations/current";
import { getMyTeams, teamDotClass } from "@/lib/teams/my-teams";

export const metadata: Metadata = { title: "Übersicht – CoFuture" };

type Round = { id: string; team_id: string; question: string; deadline: string; status: "open" | "closed" | "decided"; closed_at: string | null };

async function PersonalDashboard() {
  const user = await getCurrentUser();
  const org = await getCurrentOrganization(user.id);
  const teams = await getMyTeams(user.id, org?.id ?? null);
  const teamIds = teams.map((t) => t.id);
  const teamIndex = new Map(teams.map((t, i) => [t.id, i]));
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  const supabase = await createClient();
  const { data: roundRows } = teamIds.length
    ? await supabase
        .from("rounds")
        .select("id, team_id, question, deadline, status, closed_at")
        .in("team_id", teamIds)
        .order("deadline")
    : { data: [] as Round[] };
  const rounds = (roundRows ?? []) as Round[];
  const open = rounds.filter((r) => r.status === "open");
  const { data: mine } = open.length
    ? await supabase.from("responses").select("round_id").in("round_id", open.map((r) => r.id))
    : { data: [] as { round_id: string }[] };
  const answered = new Set((mine ?? []).map((r) => r.round_id));

  // Decisions you have not confirmed yet (RLS: decisions of your teams, only your own read receipts).
  const [{ data: decisionRows }, { data: ownReads }] = teamIds.length
    ? await Promise.all([
        supabase
          .from("decisions")
          .select("id, team_id, round_id, body, created_at")
          .in("team_id", teamIds)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("decision_reads").select("decision_id"),
      ])
    : [{ data: [] }, { data: [] }];
  const readIds = new Set((ownReads ?? []).map((r) => r.decision_id));
  const unreadDecisions = (decisionRows ?? []).filter((d) => !readIds.has(d.id));

  const waiting = open.filter((r) => !answered.has(r.id));
  const running = open.filter((r) => answered.has(r.id));
  const finished = rounds
    .filter((r) => r.status !== "open")
    .sort((a, b) => (b.closed_at ?? b.deadline).localeCompare(a.closed_at ?? a.deadline));
  const waitingByTeam = new Map<string, number>();
  for (const r of waiting) waitingByTeam.set(r.team_id, (waitingByTeam.get(r.team_id) ?? 0) + 1);

  const stats = [
    { label: "Wartet auf dich", value: waiting.length, Icon: Inbox },
    { label: "Laufende Runden", value: open.length, Icon: Clock },
    { label: "Abgeschlossen", value: finished.length, Icon: CircleCheck },
    { label: "Deine Teams", value: teams.length, Icon: Users },
  ];

  function TeamTag({ teamId }: { teamId: string }) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className={`size-2.5 rounded-full ${teamDotClass(teamIndex.get(teamId) ?? 0)}`} aria-hidden />
        {teamName.get(teamId)}
      </span>
    );
  }

  return (
    <>
      <p className="text-label text-ink-muted">{org?.name ?? "Ohne Organisation"}</p>
      <h1 className="text-h1">Hallo, {user.displayName}</h1>
      <p className="mt-1 max-w-[680px] text-body text-ink-muted">Hier siehst du, was in deinen Teams gerade ansteht.</p>

      {!org ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
          <p className="text-body">Du gehörst noch zu keiner Organisation. Leg eine an, um Personen und Teams zu verwalten.</p>
          <Link href="/app/organisation/neu" className={buttonStyles.secondary}>
            Organisation anlegen
          </Link>
        </div>
      ) : null}

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
          <section aria-labelledby="waiting-heading">
            <h2 id="waiting-heading" className="mb-4 text-h2">
              Wartet auf deine Antwort
            </h2>
            {waiting.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {waiting.map((round) => (
                  <li key={round.id}>
                    <Link
                      href={`/app/runden/${round.id}`}
                      className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong sm:flex-row sm:items-center"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-2">
                        <span className="text-h3">{round.question}</span>
                        <span className="flex flex-wrap items-center gap-3 text-body-sm text-ink-muted">
                          <TeamTag teamId={round.team_id} />
                          <span>Frist: {formatDateTime(round.deadline)}</span>
                          <Countdown deadline={round.deadline} />
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2 self-start text-label text-primary sm:self-center">
                        Jetzt antworten
                        <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-line bg-card p-4">
                <p className="flex items-center gap-2 text-body text-ink-muted">
                  <CircleCheck size={20} strokeWidth={1.75} aria-hidden />
                  Alles beantwortet. Neue Fragen aus deinen Teams erscheinen hier.
                </p>
              </div>
            )}
          </section>

          {unreadDecisions.length > 0 ? (
            <section aria-labelledby="decisions-heading">
              <h2 id="decisions-heading" className="mb-1 flex items-center gap-2 text-h2">
                <Gavel size={20} strokeWidth={1.75} aria-hidden />
                Neue Beschlüsse
              </h2>
              <p className="mb-4 text-body-sm text-ink-muted">Lies sie und bestätige, dass du sie kennst.</p>
              <ul className="flex flex-col gap-3">
                {unreadDecisions.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/app/runden/${d.round_id}`}
                      className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong"
                    >
                      <span className="text-body font-semibold">{d.body}</span>
                      <span className="flex flex-wrap items-center gap-3 text-body-sm text-ink-muted">
                        <TeamTag teamId={d.team_id} />
                        <span>{formatDateTime(d.created_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {running.length > 0 ? (
            <section aria-labelledby="running-heading">
              <h2 id="running-heading" className="mb-1 text-h2">
                Läuft noch
              </h2>
              <p className="mb-4 text-body-sm text-ink-muted">Du hast geantwortet. Bis zur Frist kannst du deine Antwort noch ändern.</p>
              <RoundList rounds={running} TeamTag={TeamTag} />
            </section>
          ) : null}

          {finished.length > 0 ? (
            <section aria-labelledby="finished-heading">
              <h2 id="finished-heading" className="mb-4 text-h2">
                Zuletzt abgeschlossen
              </h2>
              <RoundList rounds={finished.slice(0, 5)} TeamTag={TeamTag} />
            </section>
          ) : null}
        </div>

        <aside aria-labelledby="teams-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="teams-heading" className="text-h2">
              Deine Teams
            </h2>
            {org?.role === "guest" ? null : (
              <Link href="/app/teams/neu" className="inline-flex min-h-11 items-center gap-1 text-label text-primary underline">
                <Plus size={16} strokeWidth={1.75} aria-hidden />
                Team anlegen
              </Link>
            )}
          </div>
          {teams.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {teams.map((team, i) => {
                const waitingHere = waitingByTeam.get(team.id) ?? 0;
                return (
                  <li key={team.id}>
                    <Link
                      href={`/app/teams/${team.id}`}
                      className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong"
                    >
                      <span className="flex items-center gap-3">
                        <span className={`size-3 shrink-0 rounded-full ${teamDotClass(i)}`} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-h3">{team.name}</span>
                        <RoleBadge role={team.role} />
                      </span>
                      <span className="text-body-sm text-ink-muted">
                        {team.openRounds === 1 ? "1 offene Runde" : `${team.openRounds} offene Runden`}
                        {waitingHere > 0 ? `, ${waitingHere} wartet auf dich` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-line bg-card p-4">
              <p className="text-body text-ink-muted">Du bist noch in keinem Team. Leg eins an oder lass dich hinzufügen.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function RoundList({ rounds, TeamTag }: { rounds: Round[]; TeamTag: (p: { teamId: string }) => React.ReactNode }) {
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
              <TeamTag teamId={round.team_id} />
              <span>Frist: {formatDateTime(round.deadline)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Übersicht wird geladen …</p>}>
      <PersonalDashboard />
    </Suspense>
  );
}
