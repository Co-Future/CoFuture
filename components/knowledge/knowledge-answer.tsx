import { Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { KnowledgeHitCard } from "@/components/knowledge/knowledge-hit";
import { askKnowledge } from "@/lib/knowledge/search";
import type { createClient } from "@/lib/db/server";

type Props = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  question: string;
  teamId?: string;
  teamName: Map<string, string>;
};

/** AsyncMeet's answer with numbered sources, then every item it consulted. */
export async function KnowledgeAnswerSection({ supabase, organizationId, question, teamId, teamName }: Props) {
  let answer: Awaited<ReturnType<typeof askKnowledge>>;
  try {
    answer = await askKnowledge(supabase, { organizationId, question, teamId });
  } catch {
    return (
      <p role="alert" className="mt-8 flex items-start gap-2 text-body text-danger-ink">
        <TriangleAlert size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
        AsyncMeet ist gerade ausgelastet. Die Suche funktioniert weiter, versuch die Frage gleich noch einmal.
      </p>
    );
  }

  const number = new Map(answer.consulted.map((h, i) => [h.id, i + 1]));
  return (
    <section aria-labelledby="answer-heading" className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-card p-4 shadow-card sm:p-6">
        <h2 id="answer-heading" className="flex items-center gap-2 text-h2">
          <Sparkles size={20} strokeWidth={1.75} aria-hidden />
          Antwort
        </h2>
        {answer.statements.length === 0 ? (
          <p className="text-body text-ink-muted">
            {answer.consulted.length === 0
              ? "Dazu gibt es noch nichts im Wissensspeicher. Er füllt sich mit jeder Zusammenfassung und jedem Beschluss."
              : "Die gefundenen Einträge beantworten die Frage nicht. AsyncMeet erfindet nichts dazu. Schau dir die Treffer unten selbst an."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {answer.statements.map((s, i) => (
              <li key={i} className="text-body-lg text-ink">
                {s.text}{" "}
                <span className="inline-flex flex-wrap gap-1 align-middle">
                  {s.sources.map((h) => (
                    <Link
                      key={h.id}
                      href={`/app/runden/${h.roundId}`}
                      aria-label={`Quelle ${number.get(h.id)}: ${h.title}`}
                      className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-primary-soft px-1.5 font-mono text-xs text-ink underline-offset-2 hover:underline"
                    >
                      {number.get(h.id)}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-body-sm text-ink-muted">
          AsyncMeet fasst zusammen, was im Wissensspeicher steht, und nennt zu jeder Aussage die Quellen. Prüf wichtige Punkte im
          Original.
          {answer.model ? (
            <span className="mt-1 block font-mono text-xs">
              {answer.model} · Prompt {answer.promptVersion}
            </span>
          ) : null}
        </p>
      </div>

      {answer.consulted.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-h3">Gefundene Einträge</h2>
          <ol className="flex flex-col gap-3">
            {answer.consulted.map((hit, i) => (
              <li key={hit.id} className="flex items-start gap-3">
                <span className="mt-4 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sunken font-mono text-xs">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <KnowledgeHitCard hit={hit} teamName={teamName.get(hit.teamId) ?? "Team"} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
