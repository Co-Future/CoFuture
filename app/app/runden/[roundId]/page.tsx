import { ArrowLeft, CornerDownRight, Gavel, MessageCircleQuestion, Mic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DecisionForm } from "@/components/decisions/decision-form";
import { KIND_LABELS } from "@/components/decisions/kind-labels";
import { ReadReceipt } from "@/components/decisions/read-receipt";
import type { MapKind } from "@/components/perspective-map";
import { AnalysisStatus } from "@/components/rounds/analysis-status";
import { AnswerEditor } from "@/components/rounds/answer-editor";
import { Clarifications } from "@/components/rounds/clarifications";
import { CloseRoundButton } from "@/components/rounds/close-round-button";
import { Countdown } from "@/components/rounds/countdown";
import { AnswerBox, Audience, Avatar, Card, QuestionNumber } from "@/components/rounds/exchange-ui";
import { RoundsLiveRefresh } from "@/components/rounds/live-refresh";
import { QuestionSummary, type SummaryPoint } from "@/components/rounds/question-summary";
import { StatusBadge } from "@/components/rounds/status-badge";
import { buttonStyles } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/server";
import { formatDateTime, isPast } from "@/lib/format";
import { uuidSchema } from "@/lib/validation/team";

export const metadata: Metadata = { title: "Austausch – CoFuture" };

type Tagged = { question_id?: string };
type AnalysisMap = {
  clusters: ((SummaryPoint & Tagged) | null)[];
  open_questions: ({ question: string; source_ids: string[] } & Tagged)[];
  overviews?: ({ text: string; source_ids: string[] } & Tagged)[];
};

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
    { data: isGuest },
    { data: parent },
  ] = await Promise.all([
    supabase
      .from("round_questions")
      .select("id, position, body, asks_starter, round_question_targets(user_id)")
      .eq("round_id", round.id)
      .order("position"),
    supabase.from("team_members").select("user_id, profiles(display_name)").eq("team_id", round.team_id),
    supabase.rpc("round_response_count", { p_round_id: round.id }),
    supabase
      .from("team_members")
      .select("role")
      .eq("team_id", round.team_id)
      .eq("user_id", user.id)
      .eq("role", "lead")
      .maybeSingle(),
    // Your own answers while open; after closing all answers to questions you may see.
    supabase
      .from("round_answers")
      .select("id, question_id, pseudonym, author_name, body, is_own, source")
      .eq("round_id", round.id),
    // Filtered in the database: parts of questions you may not see are left out.
    supabase.rpc("round_analysis", { p_round_id: round.id }).maybeSingle(),
    supabase
      .from("analysis_jobs")
      .select("id, status, error, attempts")
      .eq("round_id", round.id)
      .eq("kind", "analyze")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("round_clarifications_public").select("*").eq("round_id", round.id).order("created_at"),
    supabase.rpc("is_guest_for_team", { p_team_id: round.team_id }),
    round.parent_round_id
      ? supabase.from("rounds").select("id, question").eq("id", round.parent_round_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Decision of this exchange (RLS: like the exchange itself), with read receipts as numbers only.
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, body, rationale, cluster_refs, created_at, profiles!decisions_decided_by_fkey(display_name)")
    .eq("round_id", round.id)
    .maybeSingle();
  const [{ data: readCounts }, { data: ownRead }] = decision
    ? await Promise.all([
        supabase.rpc("decision_read_count", { p_decision_id: decision.id }),
        supabase.from("decision_reads").select("read_at").eq("decision_id", decision.id).eq("user_id", user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  const isCreator = round.created_by === user.id;
  const people = (members ?? [])
    .map((m) => ({ userId: m.user_id, name: m.profiles?.display_name ?? "Unbekannt" }))
    .sort((x, y) => x.name.localeCompare(y.name, "de"));
  const nameOf = (id: string) => (id === user.id ? "Du" : (people.find((p) => p.userId === id)?.name ?? "Ehemaliges Mitglied"));
  // Same rule as question_is_for_me in the database.
  const isFor = (q: { targets: string[]; asksStarter: boolean }, id: string) =>
    q.targets.includes(id) || (id === round.created_by ? q.asksStarter : q.targets.length === 0);
  const questions = (questionRows ?? []).map((q, i) => ({
    id: q.id,
    number: i + 1,
    body: q.body,
    targets: q.round_question_targets.map((t) => t.user_id),
    asksStarter: q.asks_starter,
  }));
  const firstQuestionId = questions[0]?.id;

  const answers = (answerRows ?? []).flatMap((a) =>
    a.id && a.question_id && a.pseudonym && a.body !== null
      ? [
          {
            id: a.id,
            questionId: a.question_id,
            key: a.pseudonym,
            name: a.is_own ? "Du" : (a.author_name ?? "Unbekannt"),
            body: a.body,
            isOwn: Boolean(a.is_own),
            voice: a.source === "voice",
          },
        ]
      : [],
  );
  const names = Object.fromEntries(answers.map((a) => [a.key, a.name]));
  const ownAnswers = Object.fromEntries(answers.filter((a) => a.isOwn).map((a) => [a.questionId, a.body]));
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
            authorName: c.is_own ? "Du" : (c.author_name ?? "Unbekannt"),
          },
        ]
      : [],
  );

  const map = analysis?.map as AnalysisMap | undefined;
  const belongs = (item: Tagged, qId: string) => (item.question_id ?? firstQuestionId) === qId;

  const deadlinePassed = round.deadline ? isPast(round.deadline) : false;
  const isOpen = round.status === "open";
  const canAnswer = isOpen && !deadlinePassed;
  const canClose = isOpen && (isCreator || Boolean(lead));
  const canFollowUp = !isOpen && !isGuest;
  const canDecide = round.status === "closed" && !decision && !isGuest && (isCreator || Boolean(lead));
  const myQuestions = questions.filter((q) => isFor(q, user.id));
  const otherQuestions = questions.filter((q) => !isFor(q, user.id));
  const listed = canAnswer ? otherQuestions : questions;
  const title = questions.length > 1 ? `${questions.length} Fragen an das Team` : (questions[0]?.body ?? round.question);

  // Clusters the decision can refer to: positions in the map, labelled with their question.
  const numberOf = (qId?: string) => questions.find((q) => q.id === (qId ?? firstQuestionId))?.number;
  const decisionClusters = (map?.clusters ?? []).flatMap((c, index) =>
    c && c.kind !== "unassigned"
      ? [
          {
            index,
            title: questions.length > 1 && numberOf(c.question_id) ? `Frage ${numberOf(c.question_id)}: ${c.title}` : c.title,
            kindLabel: KIND_LABELS[c.kind as MapKind] ?? c.kind,
          },
        ]
      : [],
  );
  const refTitle = (i: number) => decisionClusters.find((c) => c.index === i);

  // Answers per person, in question order (only after closing; while open you only see your own).
  const byPerson = [...new Set(answers.map((a) => a.key))]
    .map((key) => {
      const own = answers.filter((a) => a.key === key);
      return {
        key,
        name: own[0].name,
        isOwn: own[0].isOwn,
        items: questions.flatMap((q) => own.filter((a) => a.questionId === q.id).map((a) => ({ q, a }))),
      };
    })
    .sort((x, y) => Number(y.isOwn) - Number(x.isOwn) || x.name.localeCompare(y.name, "de"));

  return (
    <>
      <Link
        href={`/app/teams/${round.team_id}`}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline"
      >
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zurück zu {round.teams?.name ?? "Team"}
      </Link>
      <RoundsLiveRefresh
        filter={{ column: "id", value: round.id }}
        openDeadlines={isOpen && round.deadline ? [round.deadline] : []}
      />

      <header className="mb-8 flex flex-col gap-3">
        <p className="text-label text-ink-muted">Austausch · {round.teams?.name ?? "Team"}</p>
        <h1 className="text-h1">{title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-body-sm text-ink-muted">
          <StatusBadge status={round.status} />
          <span>{round.deadline ? `${isOpen ? "Frist" : "Frist war"} ${formatDateTime(round.deadline)}` : "Ohne Frist"}</span>
          {isOpen && round.deadline ? <Countdown deadline={round.deadline} /> : null}
          <span>{(count ?? 0) === 1 ? "1 Person hat geantwortet" : `${count ?? 0} Personen haben geantwortet`}</span>
        </div>
        {parent ? (
          <p className="flex items-start gap-2 text-body-sm text-ink-muted">
            <CornerDownRight aria-hidden size={20} strokeWidth={1.75} className="shrink-0" />
            <span>
              Folgt auf{" "}
              <Link href={`/app/runden/${parent.id}`} className="text-primary underline">
                {parent.question}
              </Link>
            </span>
          </p>
        ) : null}
        {round.context ? <p className="max-w-[680px] whitespace-pre-line text-body-lg text-ink-muted">{round.context}</p> : null}
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 max-w-[760px] flex-col gap-10">
          {isOpen ? (
            <>
              {canAnswer && myQuestions.length > 0 ? (
                <section aria-labelledby="answer-heading">
                  <h2 id="answer-heading" className="mb-4 text-h2">
                    Deine Fragen
                  </h2>
                  <AnswerEditor
                    roundId={round.id}
                    questions={myQuestions.map((q) => ({ id: q.id, number: q.number, body: q.body }))}
                    saved={ownAnswers}
                  />
                </section>
              ) : null}

              {deadlinePassed ? (
                <p className="rounded-md bg-warning-soft px-3 py-2 text-body text-warning-ink">
                  Die Frist ist abgelaufen. Der Austausch wird in Kürze geschlossen, danach siehst du alle Antworten.
                </p>
              ) : null}

              {listed.length > 0 ? (
                <section aria-labelledby="questions-heading">
                  <h2 id="questions-heading" className="mb-4 text-h2">
                    {canAnswer && myQuestions.length > 0 ? "Weitere Fragen in diesem Austausch" : "Fragen"}
                  </h2>
                  <ol className="flex flex-col gap-3">
                    {listed.map((q) => (
                      <li key={q.id}>
                        <Card className="flex items-start gap-3">
                          <QuestionNumber n={q.number} />
                          <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <p className="font-display text-h3 text-ink">{q.body}</p>
                            <Audience names={q.targets.map(nameOf)} />
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </>
          ) : (
            <>
              <section aria-labelledby="summary-heading" className="flex flex-col gap-4">
                <div>
                  <h2 id="summary-heading" className="text-h2">
                    Zusammenfassung je Frage
                  </h2>
                  <p className="mt-1 text-body-sm text-ink-muted">
                    AsyncMeet fasst die Antworten zusammen und zeigt, wer was gesagt hat. Die einzelnen Antworten stehen weiter
                    unten.
                  </p>
                </div>
                {!analysis && answers.length > 0 ? <AnalysisStatus roundId={round.id} job={job} /> : null}
                <ol className="flex flex-col gap-4">
                  {questions.map((q) => {
                    const qAnswers = answers.filter((a) => a.questionId === q.id);
                    const points = (map?.clusters ?? []).flatMap((c) => (c && belongs(c, q.id) ? [c] : []));
                    const overview = (map?.overviews ?? []).find((v) => belongs(v, q.id)) ?? null;
                    return (
                      <li key={q.id}>
                        <Card className="flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <QuestionNumber n={q.number} />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <p className="font-display text-h3 text-ink">{q.body}</p>
                              <p className="text-body-sm text-ink-muted">
                                {qAnswers.length === 1 ? "1 Antwort" : `${qAnswers.length} Antworten`}
                              </p>
                            </div>
                          </div>
                          {qAnswers.length === 0 ? (
                            <p className="text-body text-ink-muted">Zu dieser Frage hat niemand geantwortet.</p>
                          ) : qAnswers.length === 1 ? (
                            <AnswerBox label={qAnswers[0].name}>
                              <p className="whitespace-pre-line">{qAnswers[0].body}</p>
                            </AnswerBox>
                          ) : (
                            <QuestionSummary
                              overview={overview}
                              points={points}
                              openQuestions={(map?.open_questions ?? []).filter((o) => belongs(o, q.id))}
                              names={names}
                              answered={qAnswers.length}
                            />
                          )}
                        </Card>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <section aria-labelledby="decision-heading" className="flex flex-col gap-4">
                <h2 id="decision-heading" className="flex items-center gap-2 text-h2">
                  <Gavel aria-hidden size={20} strokeWidth={1.75} />
                  Beschluss
                </h2>
                {decision ? (
                  <Card className="flex flex-col gap-4">
                    <p className="text-caption text-ink-muted">
                      Beschlossen am {formatDateTime(decision.created_at)}
                      {decision.profiles?.display_name ? ` von ${decision.profiles.display_name}` : ""}
                    </p>
                    <p className="whitespace-pre-line text-body-lg font-semibold">{decision.body}</p>
                    <div>
                      <h3 className="text-label">Begründung</h3>
                      <p className="mt-1 whitespace-pre-line text-body">{decision.rationale}</p>
                    </div>
                    {decision.cluster_refs.some((i) => refTitle(i)) ? (
                      <div>
                        <h3 className="text-label">Stützt sich auf</h3>
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {decision.cluster_refs.flatMap((i) => {
                            const ref = refTitle(i);
                            return ref
                              ? [
                                  <li key={i} className="rounded-full bg-sunken px-3 py-1 text-body-sm">
                                    {ref.title}
                                    <span className="text-ink-muted"> · {ref.kindLabel}</span>
                                  </li>,
                                ]
                              : [];
                          })}
                        </ul>
                      </div>
                    ) : null}
                    <ReadReceipt
                      decisionId={decision.id}
                      hasRead={Boolean(ownRead)}
                      readCount={readCounts?.[0]?.read_count ?? 0}
                      memberCount={readCounts?.[0]?.member_count ?? 0}
                    />
                  </Card>
                ) : canDecide ? (
                  <DecisionForm roundId={round.id} clusters={decisionClusters} />
                ) : (
                  <p className="text-body text-ink-muted">
                    Noch kein Beschluss. Festhalten kann ihn, wer den Austausch gestartet hat, oder die Teamleitung. Nicht jeder
                    Austausch braucht einen.
                  </p>
                )}
              </section>

              <section aria-labelledby="people-answers-heading" className="flex flex-col gap-4">
                <h2 id="people-answers-heading" className="text-h2">
                  Antworten je Person
                </h2>
                {byPerson.length === 0 ? (
                  <p className="text-body text-ink-muted">In diesem Austausch hat niemand geantwortet.</p>
                ) : (
                  byPerson.map((person) => (
                    <details
                      key={person.key}
                      className="rounded-lg border border-line bg-card shadow-card"
                      open={byPerson.length <= 3}
                    >
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-4">
                        <Avatar name={person.name} />
                        <span className="flex-1 font-display text-h3">{person.name}</span>
                        <span className="text-body-sm text-ink-muted">
                          {person.items.length === 1 ? "1 Antwort" : `${person.items.length} Antworten`}
                        </span>
                      </summary>
                      <div className="flex flex-col gap-4 border-t border-line p-4">
                        {person.items.map(({ q, a }) => (
                          <div key={a.id} className="flex flex-col gap-2">
                            <p className="flex items-start gap-2 text-body font-semibold text-ink">
                              <span className="font-display text-ink-muted">{q.number}.</span>
                              {q.body}
                            </p>
                            <AnswerBox label={a.voice ? "Antwort, eingesprochen" : "Antwort"}>
                              <p className="whitespace-pre-line">{a.body}</p>
                            </AnswerBox>
                          </div>
                        ))}
                        {isCreator
                          ? clarifications
                              .filter((c) => c.authorName === person.name)
                              .map((c) => (
                                <div key={c.id} className="rounded-md bg-sunken p-3 text-body">
                                  <p className="mb-1 inline-flex items-center gap-1 text-label">
                                    <MessageCircleQuestion size={16} strokeWidth={1.75} aria-hidden />
                                    Rückfrage{c.questionNumber ? ` zu Frage ${c.questionNumber}` : ""}
                                  </p>
                                  <p className="whitespace-pre-line">{c.body}</p>
                                  {c.answer ? <p className="mt-2 text-ink-muted">Deine Antwort: {c.answer}</p> : null}
                                </div>
                              ))
                          : null}
                      </div>
                    </details>
                  ))
                )}
              </section>
            </>
          )}

          {isOpen || clarifications.length > 0 ? (
            <section aria-labelledby="clarifications-heading">
              <h2 id="clarifications-heading" className="mb-1 text-h2">
                Rückfragen
              </h2>
              <p className="mb-4 text-body-sm text-ink-muted">
                {isCreator
                  ? "Rückfragen an dich. Nur du und die fragende Person sehen sie."
                  : "Fragen an die Person, die den Austausch gestartet hat. Nur ihr beide seht sie."}
              </p>
              <Clarifications
                roundId={round.id}
                items={clarifications}
                questions={questions.map((q) => ({ id: q.id, number: q.number }))}
                canAsk={isOpen}
                canAnswer={isCreator}
              />
            </section>
          ) : null}

          {canClose || canFollowUp ? (
            <div className="flex flex-wrap gap-3">
              {canClose ? <CloseRoundButton roundId={round.id} /> : null}
              {canFollowUp ? (
                <Link href={`/app/teams/${round.team_id}/runden/neu?von=${round.id}`} className={buttonStyles.secondary}>
                  <CornerDownRight aria-hidden size={20} strokeWidth={1.75} />
                  Folge-Austausch starten
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside aria-labelledby="people-heading" className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <h2 id="people-heading" className="text-h3">
            Personen im Team
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-card">
            {people.map((p) => {
              const asked = questions.filter((q) => isFor(q, p.userId)).length;
              return (
                <li key={p.userId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={p.name} />
                  <span className="min-w-0 flex-1 truncate text-body">
                    {p.name}
                    {p.userId === user.id ? <span className="text-ink-muted"> (du)</span> : null}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-body-sm ${asked > 0 ? "bg-primary-soft text-ink" : "bg-sunken text-ink-muted"}`}
                  >
                    {asked}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-body-sm text-ink-muted">Zahl der Fragen, die du siehst und die an die Person gehen.</p>
          {answers.some((a) => a.voice) ? (
            <p className="inline-flex items-start gap-1 text-body-sm text-ink-muted">
              <Mic size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
              Eingesprochene Antworten hat AsyncMeet zusammengefasst, die Person hat sie geprüft.
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}

export default function RoundPage({ params }: PageProps<"/app/runden/[roundId]">) {
  return (
    <Suspense fallback={<p className="text-body text-ink-muted">Austausch wird geladen …</p>}>
      <RoundDetail params={params} />
    </Suspense>
  );
}
