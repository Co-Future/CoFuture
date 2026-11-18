import { ArrowLeft, CornerDownRight, Gavel, Mic, UserRound, Users } from "lucide-react";
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
import { AnswerEditor } from "@/components/rounds/answer-editor";
import { Clarifications } from "@/components/rounds/clarifications";
import { StatusBadge } from "@/components/rounds/status-badge";
import { buttonStyles } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { formatDateTime, isPast } from "@/lib/format";
import { uuidSchema } from "@/lib/validation/team";

export const metadata: Metadata = { title: "Austausch – CoFuture" };

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

  const [
    { data: questionRows },
    { data: members },
    { data: count },
    { data: lead },
    { data: answerRows },
    { data: analysis },
    { data: job },
    { data: clarificationRows },
  ] = await Promise.all([
    supabase.from("round_questions").select("id, position, body, round_question_targets(user_id)").eq("round_id", round.id).order("position"),
    supabase.from("team_members").select("user_id, profiles(display_name)").eq("team_id", round.team_id),
    supabase.rpc("round_response_count", { p_round_id: round.id }),
    supabase.from("team_members").select("role").eq("team_id", round.team_id).eq("user_id", user.id).eq("role", "lead").maybeSingle(),
    // Your own answers while open; everyone's after closing (pseudonyms only).
    supabase.from("round_answers").select("id, question_id, pseudonym, body, is_own, source").eq("round_id", round.id).order("pseudonym"),
    supabase.from("analyses").select("map, model, prompt_version, created_at").eq("round_id", round.id).maybeSingle(),
    supabase
      .from("analysis_jobs")
      .select("id, status, error, attempts")
      .eq("round_id", round.id)
      .eq("kind", "analyze")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("round_clarifications_public").select("*").eq("round_id", round.id).order("created_at"),
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
  const map = analysis?.map as { clusters: (MapCluster & { question_id?: string })[]; open_questions: (MapQuestion & { question_id?: string })[] } | undefined;
  const people = (members ?? [])
    .map((m) => ({ userId: m.user_id, name: m.profiles?.display_name ?? "Unbekannt" }))
    .sort((x, y) => x.name.localeCompare(y.name, "de"));
  const nameOf = (id: string) => people.find((p) => p.userId === id)?.name ?? "Ehemaliges Mitglied";
  const questions = (questionRows ?? []).map((q, i) => {
    const targets = q.round_question_targets.map((t) => t.user_id);
    return { id: q.id, number: i + 1, body: q.body, targets, forMe: targets.length === 0 || targets.includes(user.id) };
  });
  const firstQuestionId = questions[0]?.id;
  const answers = (answerRows ?? []).flatMap((a) =>
    a.id && a.question_id && a.pseudonym && a.body !== null
      ? [{ id: a.id, questionId: a.question_id, pseudonym: a.pseudonym, body: a.body, isOwn: Boolean(a.is_own), voice: a.source === "voice" }]
      : [],
  );
  const ownAnswers = Object.fromEntries(answers.filter((a) => a.isOwn).map((a) => [a.questionId, a.body]));
  const ownPseudonym = answers.find((a) => a.isOwn)?.pseudonym ?? null;
  const clarifications = (clarificationRows ?? []).flatMap((c) =>
    c.id && c.body && c.created_at
      ? [
          {
            id: c.id,
            questionNumber: questions.find((q) => q.id === c.question_id)?.number ?? null,
            body: c.body,
            answer: c.answer,
            answeredAt: c.answered_at,
            createdAt: c.created_at,
            isOwn: Boolean(c.is_own),
          },
        ]
      : [],
  );

  const deadlinePassed = round.deadline ? isPast(round.deadline) : false;
  const canAnswer = round.status === "open" && !deadlinePassed;
  const isStarter = round.created_by === user.id || Boolean(lead);
  const canClose = round.status === "open" && isStarter;
  const answerCount = count ?? 0;
  const canDecide = round.status === "closed" && !isGuest && isStarter;
  const canFollowUp = round.status !== "open" && !isGuest;
  const followUpHref = `/app/teams/${round.team_id}/runden/neu?von=${round.id}`;
  // Flat cluster list across questions: decisions refer to these indexes.
  const mapClusters = (map?.clusters ?? []).map((c, index) => ({
    index,
    title: questions.length > 1 ? `F${questions.find((q) => q.id === (c.question_id ?? firstQuestionId))?.number ?? "?"}: ${c.title}` : c.title,
    kindLabel: KIND_LABELS[c.kind],
  }));
  const myQuestions = questions.filter((q) => q.forMe);
  const title = questions.length > 1 ? `Austausch mit ${questions.length} Fragen` : (questions[0]?.body ?? round.question);

  return (
    <>
      <Link href={`/app/teams/${round.team_id}`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline">
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zurück zu {round.teams?.name ?? "Team"}
      </Link>
      <RoundsLiveRefresh
        filter={{ column: "id", value: round.id }}
        openDeadlines={round.status === "open" && round.deadline ? [round.deadline] : []}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0 max-w-[680px]">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={round.status} />
            <span className="text-body-sm text-ink-muted">
              {round.deadline ? `${round.status === "open" ? "Frist" : "Frist war"}: ${formatDateTime(round.deadline)}` : "Ohne Frist"}
            </span>
            {round.status === "open" && round.deadline ? <Countdown deadline={round.deadline} /> : null}
            <span className="text-body-sm text-ink-muted">{answerCount === 1 ? "1 Person hat geantwortet" : `${answerCount} Personen haben geantwortet`}</span>
          </div>
          {parent ? (
            <p className="mt-4 flex items-start gap-2 text-body-sm text-ink-muted">
              <CornerDownRight aria-hidden size={20} strokeWidth={1.75} className="shrink-0" />
              <span>
                Folge-Austausch zu{" "}
                <Link href={`/app/runden/${parent.id}`} className="text-primary underline">
                  {parent.question}
                </Link>
              </span>
            </p>
          ) : null}
          <h1 className="mt-4 text-h1">{title}</h1>
          {round.context ? <p className="mt-4 whitespace-pre-line text-body-lg text-ink-muted">{round.context}</p> : null}

          <section aria-labelledby="questions-heading" className="mt-8">
            <h2 id="questions-heading" className="mb-4 text-h2">
              Fragen
            </h2>
            <ol className="flex flex-col gap-3">
              {questions.map((q) => (
                <li key={q.id} className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-card">
                  <p className="text-body font-semibold">
                    <span className="mr-2 font-mono text-body-sm text-ink-muted">Frage {q.number}</span>
                    {q.body}
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
                    {q.targets.length === 0 ? (
                      <>
                        <Users size={16} strokeWidth={1.75} aria-hidden />
                        <span>Geht an alle im Team</span>
                      </>
                    ) : (
                      <>
                        <UserRound size={16} strokeWidth={1.75} aria-hidden />
                        <span>Geht an:</span>
                        {q.targets.map((t) => (
                          <span key={t} className="rounded-full bg-sunken px-2 py-0.5 text-ink">
                            {nameOf(t)}
                            {t === user.id ? " (du)" : ""}
                          </span>
                        ))}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {canAnswer ? (
            <section aria-labelledby="answer-heading" className="mt-10">
              <h2 id="answer-heading" className="mb-4 text-h2">
                Deine Antworten
              </h2>
              {myQuestions.length > 0 ? (
                <AnswerEditor
                  key={ownPseudonym ?? "neu"}
                  roundId={round.id}
                  questions={myQuestions.map((q) => ({ id: q.id, number: q.number, body: q.body }))}
                  saved={ownAnswers}
                  pseudonym={ownPseudonym}
                />
              ) : (
                <p className="text-body text-ink-muted">Keine der Fragen geht an dich. Du kannst trotzdem Rückfragen stellen.</p>
              )}
            </section>
          ) : null}

          {round.status === "open" && deadlinePassed ? (
            <p className="mt-10 rounded-md bg-warning-soft px-3 py-2 text-body text-warning-ink">
              Die Frist ist abgelaufen. Der Austausch wird in Kürze geschlossen, danach siehst du alle Antworten.
            </p>
          ) : null}

          {round.status === "open" || clarifications.length > 0 ? (
            <section aria-labelledby="clarifications-heading" className="mt-10">
              <h2 id="clarifications-heading" className="mb-1 text-h2">
                Rückfragen ({clarifications.length})
              </h2>
              <p className="mb-4 text-body-sm text-ink-muted">Fragen an die Person, die den Austausch gestartet hat.</p>
              <Clarifications
                roundId={round.id}
                items={clarifications}
                questions={questions.map((q) => ({ id: q.id, number: q.number }))}
                canAsk={round.status === "open"}
                canAnswer={isStarter}
              />
            </section>
          ) : null}

          {canClose ? (
            <section aria-label="Austausch verwalten" className="mt-8">
              <CloseRoundButton roundId={round.id} />
            </section>
          ) : null}
        </article>

        <aside aria-labelledby="people-heading" className="flex flex-col gap-3">
          <h2 id="people-heading" className="text-h3">
            Personen im Team ({people.length})
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-card">
            {people.map((p) => {
              const asked = questions.filter((q) => q.targets.length === 0 || q.targets.includes(p.userId)).length;
              return (
                <li key={p.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-body">
                    {p.name}
                    {p.userId === user.id ? <span className="text-ink-muted"> (du)</span> : null}
                  </span>
                  <span className="text-body-sm text-ink-muted">{asked === 1 ? "1 Frage" : `${asked} Fragen`}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-body-sm text-ink-muted">Zeigt, wie viele Fragen an jede Person gehen. Wer schon geantwortet hat, sieht niemand.</p>
        </aside>
      </div>

      {round.status !== "open" && answers.length > 0 ? (
        <section aria-labelledby="results-heading" className="mt-12">
          <h2 id="results-heading" className="mb-2 text-h2">
            Ergebnisse je Frage
          </h2>
          {analysis && map ? (
            <p className="mb-6 text-body-sm text-ink-muted">
              AsyncMeet fasst zusammen und zeigt zu jeder Aussage die Beiträge. Entscheiden müsst ihr selbst.{" "}
              <span className="font-mono text-xs">
                {analysis.model} · Prompt {analysis.prompt_version} · {formatDateTime(analysis.created_at)}
              </span>
            </p>
          ) : (
            <div className="mb-6">
              <AnalysisStatus roundId={round.id} job={job} />
            </div>
          )}
          <div className="flex flex-col gap-12">
            {questions.map((q) => {
              const qAnswers = answers.filter((a) => a.questionId === q.id);
              const sources = Object.fromEntries(qAnswers.map((a) => [a.pseudonym, { text: a.body, voice: a.voice, label: a.isOwn ? "du" : undefined }]));
              const belongs = (item: { question_id?: string }) => (item.question_id ?? firstQuestionId) === q.id;
              const clusters = (map?.clusters ?? []).filter(belongs);
              const openQs = (map?.open_questions ?? []).filter(belongs);
              const asked = q.targets.length === 0 ? people.length : q.targets.length;
              return (
                <section key={q.id} aria-labelledby={`result-${q.id}`} className="flex flex-col gap-4">
                  {clusters.length > 0 ? (
                    <PerspectiveMapView
                      heading={
                        <h3 id={`result-${q.id}`} className="text-h2">
                          Frage {q.number}: {q.body}
                        </h3>
                      }
                      eyebrow={`${qAnswers.length} von ${asked} gefragten Personen haben geantwortet`}
                      clusters={clusters}
                      openQuestions={openQs}
                      sources={sources}
                      followUpHref={canFollowUp ? followUpHref : undefined}
                    />
                  ) : (
                    <h3 id={`result-${q.id}`} className="text-h3">
                      Frage {q.number}: {q.body}
                    </h3>
                  )}
                  <details className="rounded-lg border border-line bg-card p-4" open={clusters.length === 0}>
                    <summary className="min-h-11 cursor-pointer text-label">Alle Antworten im Original ({qAnswers.length})</summary>
                    {qAnswers.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-3">
                        {qAnswers.map((a) => (
                          <li key={a.id} className="rounded-md bg-sunken p-3">
                            <p className="mb-1 flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
                              <span className="font-mono">
                                {a.pseudonym}
                                {a.isOwn ? " (du)" : ""}
                              </span>
                              {a.voice ? (
                                <span className="inline-flex items-center gap-1">
                                  <Mic size={16} strokeWidth={1.75} aria-hidden />
                                  per Sprache
                                </span>
                              ) : null}
                            </p>
                            <p className="whitespace-pre-line text-body">{a.body}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-body text-ink-muted">Zu dieser Frage hat niemand geantwortet.</p>
                    )}
                  </details>
                </section>
              );
            })}
          </div>
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
                Noch kein Beschluss. Festhalten kann ihn, wer den Austausch gestartet hat, oder die Teamleitung.
              </p>
            )}
          </section>
        ) : null}

        {round.status !== "open" && (canFollowUp || (followUps && followUps.length > 0)) ? (
          <section aria-labelledby="followups-heading" className="mt-10">
            <h2 id="followups-heading" className="mb-4 text-h2">
              Folge-Austausche
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
                  ? "Ergibt sich etwas Neues, starte einen Folge-Austausch. Er wird mit diesem verknüpft."
                  : "Ist noch etwas offen? Starte einen Folge-Austausch, bevor ihr beschließt."}
              </p>
            )}
            {canFollowUp ? (
              <Link href={followUpHref} className={buttonStyles.secondary}>
                <CornerDownRight aria-hidden size={20} strokeWidth={1.75} />
                Folge-Austausch starten
              </Link>
            ) : null}
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
