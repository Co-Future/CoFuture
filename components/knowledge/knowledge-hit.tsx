import { BookOpen, FileText, Gavel } from "lucide-react";
import Link from "next/link";
import { KIND_LABELS } from "@/components/decisions/kind-labels";
import type { MapKind } from "@/components/perspective-map";
import { snippetParts, type KnowledgeHit } from "@/lib/knowledge/search";
import { formatDateTime } from "@/lib/format";

const KIND = {
  overview: { label: "Zusammenfassung", icon: <FileText size={16} strokeWidth={1.75} aria-hidden /> },
  cluster: { label: "Themengruppe", icon: <BookOpen size={16} strokeWidth={1.75} aria-hidden /> },
  decision: { label: "Beschluss", icon: <Gavel size={16} strokeWidth={1.75} aria-hidden /> },
} as const;

/** One search hit: what it is, where it comes from, an excerpt and the link to the original. */
export function KnowledgeHitCard({ hit, teamName }: { hit: KnowledgeHit; teamName: string }) {
  const kind = KIND[hit.kind];
  // A decision's content starts with its own text, which is already the title.
  const text =
    hit.kind === "decision" && hit.snippet.startsWith(hit.title) ? hit.snippet.slice(hit.title.length).trimStart() : hit.snippet;
  const excerpt = snippetParts(text.length > 360 && !hit.matchedText ? `${text.slice(0, 360)} …` : text);
  return (
    <Link
      href={`/app/runden/${hit.roundId}`}
      className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-card hover:border-border-strong"
    >
      <span className="flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
        <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold text-ink">
          {kind.icon}
          {kind.label}
          {hit.kind === "cluster" && hit.clusterKind ? ` · ${KIND_LABELS[hit.clusterKind as MapKind] ?? hit.clusterKind}` : ""}
        </span>
        <span>{teamName}</span>
        <span aria-hidden>·</span>
        <span>{formatDateTime(hit.createdAt)}</span>
      </span>
      <span className="font-display text-h3 text-ink">{hit.title}</span>
      <span className="whitespace-pre-line text-body text-ink">
        {excerpt.map((part, i) =>
          part.mark ? (
            <mark key={i} className="rounded-sm bg-primary-soft px-0.5 text-ink">
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </span>
      <span className="text-body-sm text-ink-muted">Frage: {hit.question}</span>
    </Link>
  );
}
