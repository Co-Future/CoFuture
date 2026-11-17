import { ArrowLeft, CornerDownRight, Gavel, Mic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DecisionForm } from "@/components/decisions/decision-form";
import { KIND_LABELS } from "@/components/decisions/kind-labels";
import { ReadReceipt } from "@/components/decisions/read-receipt";
import { PerspectiveMapView, type MapCluster, type MapQuestion } from "@/components/perspective-map";
import { AnalysisStatus } from "@/components/rounds/analysis-status";
import { CloseRoundButton } from "@/components/rounds/close-round-button";
import { Countdown } from "@/components/rounds/countdown";
import { RoundsLiveRefresh } from "@/components/rounds/live-refresh";
import { ResponseEditor } from "@/components/rounds/response-editor";
import { StatusBadge } from "@/components/rounds/status-badge";
import { buttonStyles } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { formatDateTime, isPast } from "@/lib/format";
import { uuidSchema } from "@/lib/validation/team";

export const metadata: Metadata = { title: "Runde – CoFuture" };

async function RoundDetail({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  if (!uuidSchema.safeParse(roundId).success) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: round } = await supabase
    .from("rounds")
    .select("id, team_id, question, context, deadline, status, created_by, closed_at, parent_round_id, teams(name)")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) notFound();

  const [{ data: own }, { data: count }, { data: lead }, { data: answers }, { data: analysis }, { data: job }] = await Promise.all([
    supabase.from("responses").select("body, pseudonym").eq("round_id", round.id).maybeSingle(),
    supabase.rpc("round_response_count", { p_round_id: round.id }),
    supabase.from("team_members").select("role").eq("team_id", round.team_id).eq("user_id", user.id).eq("role", "lead").maybeSingle(),
    supabase.from("round_responses").select("id, pseudonym, body, is_own, source").eq("round_id", round.id).order("pseudonym"),
    supabase.from("analyses").select("map, model, prompt_version, created_at").eq("round_id", round.id).maybeSingle(),
    supabase
      .from("analysis_jobs")
      .select("id, status, error, attempts")
      .eq("round_id", round.id)
      .eq("kind", "analyze")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const [{ data: decision }, { data: followUps }, { data: parent }, { data: isGuest }] = await Promise.all([
    supabase
      .from("decisions")
      .select("id, body, rationale, cluster_refs, created_at, profiles!decisions_decided_by_fkey(display_name)")
      .eq("round_id", round.id)
      .maybeSingle(),
    supabase.from("rounds").select("id, question, status").eq("parent_round_id", round.id).order("created_at"),
    round.parent_round_id
      ? supabase.from("rounds").select("id, question").eq("id", round.parent_round_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("is_guest_for_team", { p_team_id: round.team_id }),
  ]);
  const [{ data: readCounts }, { data: ownRead }] = decision
    ? await Promise.all([
        supabase.rpc("decision_read_count", { p_decision_id: decision.id }),
        supabase.from("decision_reads").select("read_at").eq("decision_id", decision.id).eq("user_id", user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const map = analysis?.map as { clusters: MapCluster[]; open_questions: MapQuestion[] } | undefined;
  const sources = Object.fromEntries(
    (answers ?? []).map((a) => [a.pseudonym, { text: a.body, voice: a.source === "voice", label: a.is_own ? "du" : undefined }]),
  );

  const deadlinePassed = isPast(round.deadline);
  const canAnswer = round.status === "open" && !deadlinePassed;
  const canClose = round.status === "open" && (round.created_by === user.id || Boolean(lead));
  const answerCount = count ?? 0;
  const canDecide = round.status === "closed" && !isGuest && (round.created_by === user.id || Boolean(lead));
  const canFollowUp = round.status !== "open" && !isGuest;
  const followUpHref = `/app/teams/${round.team_id}/runden/neu?von=${round.id}`;
  const mapClusters = (map?.clusters ?? []).map((c, index) => ({ index, title: c.title, kindLabel: KIND_LABELS[c.kind] }));

  return (
    <>
      <Link href={`/app/teams/${round.team_id}`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline">
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zurück zu {round.teams?.name ?? "Team"}
      </Link>

      <article className="max-w-[680px]">
        <RoundsLiveRefresh
          filter={{ column: "id", value: round.id }}
          openDeadlines={round.status === "open" ? [round.deadline] : []}
        />
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={round.status} />
          <span className="text-body-sm text-ink-muted">
            {round.status === "open" ? "Frist" : "Frist war"}: {formatDateTime(round.deadline)}
          </span>
          {round.status === "open" ? <Countdown deadline={round.deadline} /> : null}
          <span className="text-body-sm text-ink-muted">
            {answerCount === 1 ? "1 Antwort" : `${answerCount} Antworten`}
          </span>
        </div>
        {parent ? (
          <p className="mt-4 flex items-start gap-2 text-body-sm text-ink-muted">
            <CornerDownRight aria-hidden size={20} strokeWidth={1.75} className="shrink-0" />
            <span>
              Folgerunde zu{" "}
              <Link href={`/app/runden/${parent.id}`} className="text-primary underline">
                {parent.question}
              </Link>
            </span>
          </p>
        ) : null}
        <h1 className="mt-4 text-h1">{round.question}</h1>
        {round.context ? <p className="mt-4 whitespace-pre-line text-body-lg text-ink-muted">{round.context}</p> : null}

        {canAnswer ? (
          <section aria-labelledby="answer-heading" className="mt-10">
            <h2 id="answer-heading" className="mb-4 text-h2">
              Deine Antwort
            </h2>
            <ResponseEditor roundId={round.id} initialBody={own?.body ?? null} pseudonym={own?.pseudonym ?? null} />
          </section>
        ) : null}

        {round.status === "open" && deadlinePassed ? (
          <p className="mt-10 rounded-md bg-warning-soft px-3 py-2 text-body text-warning-ink">
            Die Frist ist abgelaufen. Die Runde wird in Kürze geschlossen, danach siehst du alle Antworten.
          </p>
        ) : null}

        {canClose ? (
          <section aria-label="Runde verwalten" className="mt-8">
            <CloseRoundButton roundId={round.id} />
          </section>
        ) : null}
      </article>

      {round.status !== "open" && answers && answers.length > 0 ? (
        <section aria-labelledby="map-heading" className="mt-10">
          {analysis && map ? (
            <PerspectiveMapView
              heading={
                <h2 id="map-heading" className="text-h2">
                  Perspektivenkarte
                </h2>
              }
              eyebrow={`Erstellt am ${formatDateTime(analysis.created_at)}`}
              clusters={map.clusters}
              openQuestions={map.open_questions}
              sources={sources}
              followUpHref={canFollowUp ? followUpHref : undefined}
              footer={
                <>
                  AsyncMeet fasst zusammen und zeigt zu jeder Aussage die Beiträge. Entscheiden müsst ihr selbst.
                  <span className="mt-1 block font-mono text-xs">
                    {analysis.model} · Prompt {analysis.prompt_version}
                  </span>
                </>
              }
            />
          ) : (
            <>
              <h2 id="map-heading" className="mb-4 text-h2">
                Perspektivenkarte
              </h2>
              <AnalysisStatus roundId={round.id} job={job} />
            </>
          )}
        </section>
      ) : null}

      <div className="max-w-[680px]">
        {round.status !== "open" ? (
          <section aria-labelledby="decision-heading" className="mt-10">
            <h2 id="decision-heading" className="mb-4 flex items-center gap-2 text-h2">
              <Gavel aria-hidden size={20} strokeWidth={1.75} />
              Beschluss
            </h2>
            {decision ? (
              <div className="flex flex-col gap-4 rounded-lg border border-line bg-card p-4 shadow-card sm:p-6">
                <p className="text-caption text-ink-muted">
                  Beschlossen am {formatDateTime(decision.created_at)}
                  {decision.profiles?.display_name ? ` von ${decision.profiles.display_name}` : ""}
                </p>
                <p className="whitespace-pre-line text-body-lg font-semibold">{decision.body}</p>
                <div>
                  <h3 className="text-label">Begründung</h3>
                  <p className="mt-1 whitespace-pre-line text-body">{decision.rationale}</p>
                </div>
                {decision.cluster_refs.length > 0 && map ? (
                  <div>
                    <h3 className="text-label">Stützt sich auf</h3>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {decision.cluster_refs
                        .filter((i) => map.clusters[i])
                        .map((i) => (
                          <li key={i} className="rounded-full bg-sunken px-3 py-1 text-body-sm">
                            {map.clusters[i].title}
                            <span className="text-ink-muted"> · {KIND_LABELS[map.clusters[i].kind]}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
                <ReadReceipt
                  decisionId={decision.id}
                  hasRead={Boolean(ownRead)}
                  readCount={readCounts?.[0]?.read_count ?? 0}
                  memberCount={readCounts?.[0]?.member_count ?? 0}
                />
              </div>
            ) : canDecide ? (
              <DecisionForm roundId={round.id} clusters={mapClusters} />
            ) : (
              <p className="text-body text-ink-muted">
                Noch kein Beschluss. Festhalten kann ihn, wer die Runde gestartet hat, oder die Teamleitung.
              </p>
            )}
          </section>
        ) : null}

        {round.status !== "open" && (canFollowUp || (followUps && followUps.length > 0)) ? (
          <section aria-labelledby="followups-heading" className="mt-10">
            <h2 id="followups-heading" className="mb-4 text-h2">
              Folgerunden
            </h2>
            {followUps && followUps.length > 0 ? (
              <ul className="mb-4 flex flex-col gap-2">
                {followUps.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/app/runden/${f.id}`}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-3 shadow-card hover:border-border-strong"
                    >
                      <span className="text-body">{f.question}</span>
                      <StatusBadge status={f.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-body text-ink-muted">
                {decision
                  ? "Ergibt sich etwas Neues, starte eine Folgerunde. Sie wird mit dieser Runde verknüpft."
                  : "Ist noch etwas offen? Stell eine Rückfrage oder starte eine Folgerunde, bevor ihr beschließt."}
              </p>
            )}
            {canFollowUp ? (
              <Link href={followUpHref} className={buttonStyles.secondary}>
                <CornerDownRight aria-hidden size={20} strokeWidth={1.75} />
                Folgerunde starten
              </Link>
            ) : null}
          </section>
        ) : null}

        {round.status !== "open" ? (
          <section aria-labelledby="answers-heading" className="mt-10">
            <h2 id="answers-heading" className="mb-4 text-h2">
              Alle Antworten
            </h2>
            {answers && answers.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {answers.map((answer) => (
                  <li key={answer.id} className="rounded-lg border border-line bg-card p-4 shadow-card">
                    <p className="mb-2 flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
                      <span className="font-mono">
                        {answer.pseudonym}
                        {answer.is_own ? " (du)" : ""}
                      </span>
                      {answer.source === "voice" ? (
                        <span className="inline-flex items-center gap-1">
                          <Mic size={16} strokeWidth={1.75} aria-hidden />
                          per Sprache
                        </span>
                      ) : null}
                    </p>
                    <p className="whitespace-pre-line text-body">{answer.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-ink-muted">In dieser Runde hat niemand geantwortet.</p>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}

export default function RoundPage({ params }: PageProps<"/app/runden/[roundId]">) {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Runde wird geladen …</p>}>
      <RoundDetail params={params} />
    </Suspense>
  );
}
