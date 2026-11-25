import { CircleHelp, MessageSquareQuote, Split, User, Users } from "lucide-react";
import { PersonChip } from "@/components/rounds/exchange-ui";
import { weightLabel, weightOf } from "@/lib/exchange/weights";

export type SummaryPoint = { title: string; kind: string; summary: string; source_ids: string[] };
type Props = {
  overview: { text: string; source_ids: string[] } | null;
  points: SummaryPoint[];
  openQuestions: { question: string; source_ids: string[] }[];
  /** Internal source id (pseudonym) → display name. */
  names: Record<string, string>;
  /** Source ids (pseudonyms) of everyone who answered this question. */
  answerIds: string[];
};

const KIND = {
  consensus: { label: "Viele sehen es so", Icon: Users, badge: "bg-success-soft text-success-ink" },
  dissent: { label: "Bedenken", Icon: Split, badge: "bg-warning-soft text-warning-ink" },
  single_voice: { label: "Einzelne Stimme", Icon: User, badge: "bg-primary-soft text-ink" },
  off_topic: { label: "Anderes Thema", Icon: MessageSquareQuote, badge: "bg-sunken text-ink-muted" },
  unassigned: { label: "Nicht zugeordnet", Icon: CircleHelp, badge: "bg-sunken text-ink-muted" },
} as const;

/**
 * Cross-section of all answers to one question ("Stimmungsbild"): a short summary, the main points
 * with how many people back each one and who, and questions that stay open. Every statement shows its sources.
 */
export function QuestionSummary({ overview, points, openQuestions, names, answerIds }: Props) {
  const answered = answerIds.length;
  const who = (ids: string[]) => ids.map((id) => names[id]).filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      {overview ? (
        <div className="rounded-lg bg-success-soft p-4">
          <p className="mb-1 text-label text-success-ink">Zusammenfassung</p>
          <p className="text-body-lg text-ink">{overview.text}</p>
          <p className="mt-2 text-body-sm text-ink-muted">
            Aus {weightOf(overview.source_ids, answerIds).count} von {answered} {answered === 1 ? "Antwort" : "Antworten"}
          </p>
        </div>
      ) : null}

      {points.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {points.map((p, i) => {
            const k = KIND[p.kind as keyof typeof KIND] ?? KIND.off_topic;
            const weight = weightOf(p.source_ids, answerIds);
            return (
              <li key={`${p.title}-${i}`} className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-body-sm ${k.badge}`}>
                    <k.Icon size={16} strokeWidth={1.75} aria-hidden />
                    {k.label}
                  </span>
                  <span className="text-body-sm text-ink-muted">{weightLabel(weight)}</span>
                </div>
                <p className="font-display text-body font-semibold text-ink">{p.title}</p>
                <p className="text-body text-ink">{p.summary}</p>
                <div className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${weight.percent}%` }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {who(p.source_ids).map((n, j) => (
                    <PersonChip key={`${n}-${j}`} name={n} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {openQuestions.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong p-4">
          <p className="mb-2 inline-flex items-center gap-1 text-label">
            <CircleHelp size={16} strokeWidth={1.75} aria-hidden />
            Offen geblieben
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
            {openQuestions.map((q, i) => (
              <li key={i}>
                {q.question} <span className="text-body-sm text-ink-muted">({who(q.source_ids).join(", ")})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
