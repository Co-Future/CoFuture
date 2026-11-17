import { ArrowLeft } from "lucide-react";
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

  return (
    <>
      <h1 className="text-h1">{team.name}</h1>
      <RoundsLiveRefresh
        filter={{ column: "team_id", value: team.id }}
        openDeadlines={(rounds ?? []).filter((r) => r.status === "open").map((r) => r.deadline)}
      />

      <section aria-labelledby="rounds-heading" className="mt-8 max-w-[680px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="rounds-heading" className="text-h2">
            Runden
          </h2>
          <Link href={`/app/teams/${team.id}/runden/neu`} className={buttonStyles.primary}>
            Runde starten
          </Link>
        </div>
        {rounds && rounds.length > 0 ? (
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
        ) : (
          <p className="text-body text-ink-muted">Noch keine Runden. Starte die erste.</p>
        )}
      </section>

      <section aria-labelledby="members-heading" className="mt-10 max-w-[680px]">
        <h2 id="members-heading" className="mb-4 text-h2">
          Mitglieder ({members.length})
        </h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-card">
          {members.map((member) => {
            const name = member.profiles?.display_name ?? "Unbekannt";
            const isSelf = member.user_id === user.id;
            return (
              <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-body font-semibold">
                    {name}
                    {isSelf ? <span className="font-normal text-ink-muted"> (du)</span> : null}
                  </span>
                  <RoleBadge role={member.role} />
                </div>
                {isSelf || isLead ? (
                  <RemoveMemberButton teamId={team.id} userId={member.user_id} name={name} isSelf={isSelf} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {isLead ? (
        <section aria-labelledby="add-heading" className="mt-10 max-w-[680px]">
          <h2 id="add-heading" className="mb-4 text-h3">
            Mitglied hinzufügen
          </h2>
          <AddMemberForm teamId={team.id} />
        </section>
      ) : null}
    </>
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
