"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CircleHelp, CircleSlash, MessageCircleQuestion, Quote, Split, User, Users } from "lucide-react";

export type MapKind = "consensus" | "dissent" | "single_voice" | "off_topic" | "unassigned";
export type MapCluster = {
  title: string;
  kind: MapKind;
  summary: string;
  source_ids: string[];
};
export type MapQuestion = { question: string; source_ids: string[] };
export type MapSource = { text: string; voice: boolean; label?: string };

// cat-* tokens in design-system order. Only for dots and surfaces.
const CATEGORY_COLORS = ["blau", "orange", "teal", "pflaume", "gold", "schiefer"].map((c) => `var(--cat-${c})`);

const kindStyle: Record<MapKind, { label: string; badge: string; icon: typeof Users }> = {
  consensus: {
    label: "Konsens",
    badge: "bg-success-soft text-success-ink",
    icon: Users,
  },
  dissent: {
    label: "Dissens",
    badge: "bg-warning-soft text-warning-ink",
    icon: Split,
  },
  single_voice: {
    label: "Einzelstimme",
    badge: "bg-primary-soft text-primary",
    icon: User,
  },
  off_topic: {
    label: "Andere Themen",
    badge: "bg-sunken text-ink-muted",
    icon: CircleSlash,
  },
  unassigned: {
    label: "Nicht zugeordnet",
    badge: "bg-sunken text-ink-muted",
    icon: CircleHelp,
  },
};

type Filter = "all" | "consensus" | "dissent" | "single_voice" | "other";
const filterOf = (kind: MapKind): Filter => (kind === "off_topic" || kind === "unassigned" ? "other" : kind);
const tabs: { value: Filter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "consensus", label: "Konsens" },
  { value: "dissent", label: "Dissens" },
  { value: "single_voice", label: "Einzelstimmen" },
  { value: "other", label: "Sonstiges" },
];

type Selection = { type: "cluster" | "question"; index: number };

type Props = {
  heading: ReactNode;
  eyebrow?: string;
  clusters: MapCluster[];
  openQuestions: MapQuestion[];
  sources: Record<string, MapSource>;
  footer?: ReactNode;
  /** Link to start a follow-up round; the selected open question is appended as ?frage=… */
  followUpHref?: string;
};

/** Perspective map: clusters with their sources. Every statement points to the original answers. */
export function PerspectiveMapView({ heading, eyebrow, clusters, openQuestions, sources, footer, followUpHref }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selection, setSelection] = useState<Selection>({
    type: "cluster",
    index: 0,
  });

  const usedTabs = tabs.filter((t) => t.value === "all" || clusters.some((c) => filterOf(c.kind) === t.value));
  const visible = clusters.map((c, index) => ({ c, index })).filter(({ c }) => filter === "all" || filterOf(c.kind) === filter);
  const total = Object.keys(sources).length;
  const covered = new Set(clusters.flatMap((c) => c.source_ids).filter((id) => id in sources)).size;

  const selected =
    selection.type === "question"
      ? {
          title: openQuestions[selection.index]?.question,
          ids: openQuestions[selection.index]?.source_ids,
          color: "var(--cat-schiefer)",
        }
      : {
          title: clusters[selection.index]?.title,
          ids: clusters[selection.index]?.source_ids,
          color: CATEGORY_COLORS[selection.index % CATEGORY_COLORS.length],
        };

  function selectTab(value: Filter) {
    setFilter(value);
    const first = clusters.findIndex((c) => value === "all" || filterOf(c.kind) === value);
    if (first >= 0) setSelection({ type: "cluster", index: first });
  }

  return (
    <div className="rounded-lg border border-line bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4 sm:p-6">
        <div>
          {eyebrow ? <p className="text-caption text-ink-muted">{eyebrow}</p> : null}
          <div className="mt-1">{heading}</div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold ${
            covered === total ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink"
          }`}
        >
          <Users aria-hidden className="size-4" strokeWidth={1.75} />
          {covered} von {total} {total === 1 ? "Beitrag" : "Beiträgen"} abgedeckt
        </span>
      </div>

      {usedTabs.length > 2 ? (
        <div
          role="tablist"
          aria-label="Perspektiven filtern"
          className="flex gap-6 overflow-x-auto border-b border-line px-4 sm:px-6"
        >
          {usedTabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={filter === t.value}
              onClick={() => selectTab(t.value)}
              className={`-mb-px min-h-11 shrink-0 border-b-[3px] py-2.5 text-label transition-colors ${
                filter === t.value ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[1.1fr_1fr]">
        <div className="grid content-start gap-6">
          <ul className="grid content-start gap-3" role={usedTabs.length > 2 ? "tabpanel" : undefined}>
            {visible.map(({ c, index }) => {
              const s = kindStyle[c.kind];
              const Icon = s.icon;
              const isActive = selection.type === "cluster" && selection.index === index;
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => setSelection({ type: "cluster", index })}
                    aria-pressed={isActive}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      isActive ? "border-primary bg-primary-soft/40" : "border-line bg-card hover:border-border-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold ${s.badge}`}
                      >
                        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                        {s.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-body-sm text-ink-muted">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{
                            background: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                          }}
                        />
                        {c.source_ids.length} {c.source_ids.length === 1 ? "Beitrag" : "Beiträge"}
                      </span>
                    </div>
                    <p className="mt-3 font-display font-semibold">{c.title}</p>
                    <p className="mt-1 text-body-sm text-ink-muted">{c.summary}</p>
                  </button>
                </li>
              );
            })}
          </ul>

          {openQuestions.length > 0 && filter === "all" ? (
            <div>
              <p className="mb-3 flex items-center gap-2 text-label">
                <MessageCircleQuestion aria-hidden size={20} strokeWidth={1.75} /> Offene Fragen
              </p>
              <ul className="grid gap-2">
                {openQuestions.map((q, index) => {
                  const isActive = selection.type === "question" && selection.index === index;
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => setSelection({ type: "question", index })}
                        aria-pressed={isActive}
                        className={`min-h-11 w-full rounded-md border px-3 py-2 text-left text-body-sm transition-colors ${
                          isActive ? "border-primary bg-primary-soft/40" : "border-line bg-card hover:border-border-strong"
                        }`}
                      >
                        {q.question}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg bg-sunken p-4" aria-live="polite">
          <p className="flex items-center gap-2 text-caption text-ink-muted">
            <Quote aria-hidden className="size-4" strokeWidth={1.75} /> Belege: {selected.title}
          </p>
          <ul className="mt-3 grid gap-3">
            {(selected.ids ?? []).map((id) => {
              const r = sources[id];
              if (!r) return null;
              return (
                <li key={id} className="rounded-lg border border-line bg-card p-3">
                  <p className="whitespace-pre-line text-body-sm">„{r.text}“</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-ink-muted">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: selected.color }} />
                    <span>{id}</span>
                    {r.label ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{r.label}</span>
                      </>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span>{r.voice ? "Sprache" : "Text"}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          {followUpHref && selection.type === "question" && openQuestions[selection.index] ? (
            <Link
              href={`${followUpHref}&frage=${encodeURIComponent(openQuestions[selection.index].question)}`}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-label text-primary underline"
            >
              <MessageCircleQuestion aria-hidden size={20} strokeWidth={1.75} />
              Als Rückfrage ans Team stellen
            </Link>
          ) : null}
          {footer ? <div className="mt-3 text-body-sm text-ink-muted">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

// Demo for the landing page. Pseudonyms, no real people.
const demoSources: Record<string, MapSource> = {
  A1: {
    label: "Fuchs",
    text: "Im Sommer ist eh wenig los, vier Tage mit längeren Tagen fände ich gut.",
    voice: true,
  },
  A2: {
    label: "Eule",
    text: "Ich bin dafür, wenn wir eine feste Erreichbarkeit für Kunden absichern.",
    voice: false,
  },
  A3: {
    label: "Dachs",
    text: "Klingt gut. Freitags wäre der freie Tag am sinnvollsten.",
    voice: true,
  },
  A4: {
    label: "Kranich",
    text: "Der Support muss jeden Werktag besetzt sein, sonst verlieren wir Kunden.",
    voice: true,
  },
  A5: {
    label: "Otter",
    text: "Kundenerreichbarkeit ist für mich der Knackpunkt, nicht die Stunden.",
    voice: false,
  },
  A6: {
    label: "Luchs",
    text: "Mit Kindern sind zehn Stunden am Tag für mich nicht machbar.",
    voice: true,
  },
  A7: {
    label: "Igel",
    text: "Längere Tage sind mit Kita-Zeiten schwer vereinbar.",
    voice: false,
  },
  A8: {
    label: "Biber",
    text: "Warum nicht flexibel: Jede Person wählt ihren freien Tag selbst.",
    voice: true,
  },
  A9: {
    label: "Reh",
    text: "Vier Tage sind gut für Konzentration und Erholung, ich bin dabei.",
    voice: false,
  },
};

const demoClusters: MapCluster[] = [
  {
    kind: "consensus",
    title: "Grundsätzlich dafür",
    summary: "Die meisten begrüßen eine 4-Tage-Woche im Sommer, vor allem für Erholung und Fokus.",
    source_ids: ["A1", "A3", "A9", "A2"],
  },
  {
    kind: "dissent",
    title: "Kundenerreichbarkeit",
    summary: "Uneinig, ob ein freier Tag für alle möglich ist, ohne den Support zu gefährden.",
    source_ids: ["A4", "A5", "A2"],
  },
  {
    kind: "dissent",
    title: "Längere Arbeitstage",
    summary: "Zehn-Stunden-Tage sind für Eltern schwer mit Betreuungszeiten vereinbar.",
    source_ids: ["A6", "A7"],
  },
  {
    kind: "single_voice",
    title: "Freien Tag selbst wählen",
    summary: "Ein Vorschlag, der beide Konflikte entschärfen könnte: individuelle freie Tage.",
    source_ids: ["A8"],
  },
];

export function PerspectiveMap() {
  return (
    <PerspectiveMapView
      eyebrow="Runde 12 · geschlossen am 14.11.2026, 12:00 Uhr"
      heading={<h3 className="text-h3">Sollen wir im Sommer auf eine 4-Tage-Woche umstellen?</h3>}
      clusters={demoClusters}
      openQuestions={[]}
      sources={demoSources}
      footer="AsyncMeet fasst zusammen und zeigt, aus welchen Beiträgen jede Aussage stammt. Pseudonyme, bis jemand dem Klarnamen zustimmt."
    />
  );
}
