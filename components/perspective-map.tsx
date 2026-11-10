"use client";

import { useState } from "react";
import { Quote, Split, User, Users } from "lucide-react";

type Kind = "konsens" | "dissens" | "einzelstimme";

type Cluster = {
  id: string;
  kind: Kind;
  title: string;
  summary: string;
  /** cat-* token, in design-system order: blau, orange, teal, pflaume, gold, schiefer */
  color: string;
  sources: string[];
};

// Demo data only. Pseudonyms, no real people.
const responses: Record<string, { author: string; text: string; voice: boolean }> = {
  A1: { author: "Fuchs", text: "Im Sommer ist eh wenig los, vier Tage mit längeren Tagen fände ich gut.", voice: true },
  A2: { author: "Eule", text: "Ich bin dafür, wenn wir eine feste Erreichbarkeit für Kunden absichern.", voice: false },
  A3: { author: "Dachs", text: "Klingt gut. Freitags wäre der freie Tag am sinnvollsten.", voice: true },
  A4: { author: "Kranich", text: "Der Support muss jeden Werktag besetzt sein, sonst verlieren wir Kunden.", voice: true },
  A5: { author: "Otter", text: "Kundenerreichbarkeit ist für mich der Knackpunkt, nicht die Stunden.", voice: false },
  A6: { author: "Luchs", text: "Mit Kindern sind zehn Stunden am Tag für mich nicht machbar.", voice: true },
  A7: { author: "Igel", text: "Längere Tage sind mit Kita-Zeiten schwer vereinbar.", voice: false },
  A8: { author: "Biber", text: "Warum nicht flexibel: Jede Person wählt ihren freien Tag selbst.", voice: true },
  A9: { author: "Reh", text: "Vier Tage sind gut für Konzentration und Erholung, ich bin dabei.", voice: false },
};

const clusters: Cluster[] = [
  {
    id: "c1",
    kind: "konsens",
    title: "Grundsätzlich dafür",
    summary: "Die meisten begrüßen eine 4-Tage-Woche im Sommer, vor allem für Erholung und Fokus.",
    color: "var(--cat-blau)",
    sources: ["A1", "A3", "A9", "A2"],
  },
  {
    id: "c2",
    kind: "dissens",
    title: "Kundenerreichbarkeit",
    summary: "Uneinig, ob ein freier Tag für alle möglich ist, ohne den Support zu gefährden.",
    color: "var(--cat-orange)",
    sources: ["A4", "A5", "A2"],
  },
  {
    id: "c3",
    kind: "dissens",
    title: "Längere Arbeitstage",
    summary: "Zehn-Stunden-Tage sind für Eltern schwer mit Betreuungszeiten vereinbar.",
    color: "var(--cat-teal)",
    sources: ["A6", "A7"],
  },
  {
    id: "c4",
    kind: "einzelstimme",
    title: "Freien Tag selbst wählen",
    summary: "Ein Vorschlag, der beide Konflikte entschärfen könnte: individuelle freie Tage.",
    color: "var(--cat-pflaume)",
    sources: ["A8"],
  },
];

const kindStyle: Record<Kind, { label: string; badge: string; icon: typeof Users }> = {
  konsens: { label: "Konsens", badge: "bg-success-soft text-success-ink", icon: Users },
  dissens: { label: "Dissens", badge: "bg-warning-soft text-warning-ink", icon: Split },
  einzelstimme: { label: "Einzelstimme", badge: "bg-primary-soft text-primary", icon: User },
};

const tabs: Array<{ value: Kind | "alle"; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "konsens", label: "Konsens" },
  { value: "dissens", label: "Dissens" },
  { value: "einzelstimme", label: "Einzelstimmen" },
];

export function PerspectiveMap() {
  const [filter, setFilter] = useState<Kind | "alle">("alle");
  const [activeId, setActiveId] = useState("c2");

  const visible = clusters.filter((c) => filter === "alle" || c.kind === filter);
  const active = clusters.find((c) => c.id === activeId) ?? clusters[0];
  const covered = new Set(clusters.flatMap((c) => c.sources)).size;
  const total = Object.keys(responses).length;

  function selectTab(value: Kind | "alle") {
    setFilter(value);
    const first = clusters.find((c) => value === "alle" || c.kind === value);
    if (first) setActiveId(first.id);
  }

  return (
    <div className="rounded-lg border border-line bg-card shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4 sm:p-6">
        <div>
          <p className="text-caption text-ink-muted">Runde 12 · geschlossen am 14.11.2026, 12:00 Uhr</p>
          <h3 className="mt-1 text-h3">Sollen wir im Sommer auf eine 4-Tage-Woche umstellen?</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-[3px] text-xs font-semibold text-success-ink">
          <Users aria-hidden className="size-4" strokeWidth={1.75} />
          {covered} von {total} Beiträgen abgedeckt
        </span>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Perspektiven filtern" className="flex gap-6 overflow-x-auto border-b border-line px-4 sm:px-6">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={filter === t.value}
            onClick={() => selectTab(t.value)}
            className={`-mb-px shrink-0 border-b-[3px] py-2.5 text-label transition-colors ${
              filter === t.value ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[1.1fr_1fr]">
        {/* Clusters */}
        <ul className="grid content-start gap-3" role="tabpanel">
          {visible.map((c) => {
            const s = kindStyle[c.kind];
            const Icon = s.icon;
            const isActive = c.id === active.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  aria-pressed={isActive}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    isActive ? "border-primary bg-primary-soft/40" : "border-line bg-card hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold ${s.badge}`}>
                      <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                      {s.label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-body-sm text-ink-muted">
                      <span aria-hidden className="size-2.5 rounded-full" style={{ background: c.color }} />
                      {c.sources.length} {c.sources.length === 1 ? "Beitrag" : "Beiträge"}
                    </span>
                  </div>
                  <p className="mt-3 font-display font-semibold">{c.title}</p>
                  <p className="mt-1 text-body-sm text-ink-muted">{c.summary}</p>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Sources */}
        <div className="rounded-lg bg-sunken p-4" aria-live="polite">
          <p className="flex items-center gap-2 text-caption text-ink-muted">
            <Quote aria-hidden className="size-4" strokeWidth={1.75} /> Belege: {active.title}
          </p>
          <ul className="mt-3 grid gap-3">
            {active.sources.map((id) => {
              const r = responses[id];
              return (
                <li key={id} className="rounded-lg border border-line bg-card p-3">
                  <p className="text-body-sm">„{r.text}“</p>
                  <p className="mt-2 flex items-center gap-2 font-mono text-xs text-ink-muted">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: active.color }} />
                    <span>{id}</span>
                    <span aria-hidden>·</span>
                    <span>{r.author}</span>
                    <span aria-hidden>·</span>
                    <span>{r.voice ? "Sprache" : "Text"}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-body-sm text-ink-muted">
            AsyncMeet fasst zusammen und zeigt, aus welchen Beiträgen jede Aussage stammt. Pseudonyme, bis jemand dem
            Klarnamen zustimmt.
          </p>
        </div>
      </div>
    </div>
  );
}
