import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CloseRoundButton } from "@/components/rounds/close-round-button";
import { ResponseEditor } from "@/components/rounds/response-editor";
import { StatusBadge } from "@/components/rounds/status-badge";
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
    .select("id, team_id, question, context, deadline, status, created_by, closed_at, teams(name)")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) notFound();

  const [{ data: own }, { data: count }, { data: lead }, { data: answers }] = await Promise.all([
    supabase.from("responses").select("body, pseudonym").eq("round_id", round.id).maybeSingle(),
    supabase.rpc("round_response_count", { p_round_id: round.id }),
    supabase.from("team_members").select("role").eq("team_id", round.team_id).eq("user_id", user.id).eq("role", "lead").maybeSingle(),
    supabase.from("round_responses").select("id, pseudonym, body, is_own").eq("round_id", round.id).order("pseudonym"),
  ]);

  const deadlinePassed = isPast(round.deadline);
  const canAnswer = round.status === "open" && !deadlinePassed;
  const canClose = round.status === "open" && (round.created_by === user.id || Boolean(lead));
  const answerCount = count ?? 0;

  return (
    <>
      <Link href={`/app/teams/${round.team_id}`} className="mb-6 inline-flex min-h-11 items-center gap-2 text-label text-primary underline">
        <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
        Zurück zu {round.teams?.name ?? "Team"}
      </Link>

      <article className="max-w-[680px]">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={round.status} />
          <span className="text-body-sm text-ink-muted">
            {round.status === "open" ? "Frist" : "Frist war"}: {formatDateTime(round.deadline)}
          </span>
          <span className="text-body-sm text-ink-muted">
            {answerCount === 1 ? "1 Antwort" : `${answerCount} Antworten`}
          </span>
        </div>
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

        {round.status !== "open" ? (
          <section aria-labelledby="answers-heading" className="mt-10">
            <h2 id="answers-heading" className="mb-4 text-h2">
              Alle Antworten
            </h2>
            {answers && answers.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {answers.map((answer) => (
                  <li key={answer.id} className="rounded-lg border border-line bg-card p-4 shadow-card">
                    <p className="mb-2 font-mono text-body-sm text-ink-muted">
                      {answer.pseudonym}
                      {answer.is_own ? " (du)" : ""}
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
      </article>
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
