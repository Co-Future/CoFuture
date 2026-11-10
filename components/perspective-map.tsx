"use client";

import { useState } from "react";
import { Quote, Users, Split, User } from "lucide-react";

type Kind = "konsens" | "dissens" | "einzelstimme";

type Cluster = {
  id: string;
  kind: Kind;
  title: string;
  summary: string;
  sources: string[];
};

// Demo data only. Pseudonyms, no real people.
const responses: Record<string, { author: string; text: string; voice: boolean }> = {
  A1: { author: "Fuchs", text: "Im Sommer ist eh wenig los, vier Tage mit längeren Tagen fände ich super.", voice: true },
  A2: { author: "Eule", text: "Ich bin dafür, wenn wir eine feste Erreichbarkeit für Kunden absichern.", voice: false },
  A3: { author: "Dachs", text: "Klingt gut. Freitags wäre der freie Tag am sinnvollsten.", voice: true },
  A4: { author: "Kranich", text: "Der Support muss jeden Werktag besetzt sein, sonst verlieren wir Kunden.", voice: true },
  A5: { author: "Otter", text: "Kundenerreichbarkeit ist für mich der Knackpunkt, nicht die Stunden.", voice: false },
  A6: { author: "Luchs", text: "Mit Kindern sind zehn Stunden am Tag für mich nicht machbar.", voice: true },
  A7: { author: "Igel", text: "Längere Tage sind mit Kita-Zeiten schwer vereinbar.", voice: false },
  A8: { author: "Biber", text: "Warum nicht flexibel: jede Person wählt ihren freien Tag selbst?", voice: true },
  A9: { author: "Reh", text: "Vier Tage sind gut für Konzentration und Erholung, bin dabei.", voice: false },
};

const clusters: Cluster[] = [
  {
    id: "c1",
    kind: "konsens",
    title: "Grundsätzlich dafür",
    summary: "Die meisten begrüßen eine 4-Tage-Woche im Sommer, vor allem für Erholung und Fokus.",
    sources: ["A1", "A3", "A9", "A2"],
  },
  {
    id: "c2",
    kind: "dissens",
    title: "Kundenerreichbarkeit",
    summary: "Uneinig, ob ein freier Tag für alle möglich ist, ohne den Support zu gefährden.",
    sources: ["A4", "A5", "A2"],
  },
  {
    id: "c3",
    kind: "dissens",
    title: "Längere Arbeitstage",
    summary: "Zehn-Stunden-Tage sind für Eltern schwer mit Betreuungszeiten vereinbar.",
    sources: ["A6", "A7"],
  },
  {
    id: "c4",
    kind: "einzelstimme",
    title: "Freien Tag selbst wählen",
    summary: "Ein Vorschlag, der beide Konflikte entschärfen könnte: individuelle freie Tage.",
    sources: ["A8"],
  },
];

const kindStyle: Record<Kind, { label: string; chip: string; dot: string; icon: typeof Users }> = {
  konsens: { label: "Konsens", chip: "bg-sage-soft text-sage", dot: "bg-sage", icon: Users },
  dissens: { label: "Dissens", chip: "bg-accent-soft text-accent", dot: "bg-accent", icon: Split },
  einzelstimme: { label: "Einzelstimme", chip: "bg-plum-soft text-plum", dot: "bg-plum", icon: User },
};

const filters: Array<{ value: Kind | "alle"; label: string }> = [
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

  return (
    <div className="rounded-3xl border border-line bg-card shadow-[0_1px_0_var(--line),0_30px_60px_-30px_color-mix(in_oklab,var(--ink)_25%,transparent)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Runde #12 · geschlossen</p>
          <p className="mt-1 font-display text-lg leading-snug text-ink">
            Sollen wir im Sommer auf eine 4-Tage-Woche umstellen?
          </p>
        </div>
        <p className="rounded-full border border-line px-3 py-1 font-mono text-xs text-ink-2">
          {covered}/{total} Antworten abgedeckt
        </p>
      </div>

      {/* Filters */}
      <div role="group" aria-label="Perspektiven filtern" className="flex flex-wrap gap-2 px-5 pt-4 sm:px-6">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setFilter(f.value);
              const first = clusters.find((c) => f.value === "alle" || c.kind === f.value);
              if (first) setActiveId(first.id);
            }}
            aria-pressed={filter === f.value}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              filter === f.value
                ? "border-ink bg-ink text-paper"
                : "border-line text-ink-2 hover:border-ink-3"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-[1.1fr_1fr]">
        {/* Clusters */}
        <ul className="grid gap-3">
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
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isActive ? "border-ink bg-paper" : "border-line hover:border-ink-3"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.chip}`}>
                      <Icon aria-hidden className="size-3.5" />
                      {s.label}
                    </span>
                    <span className="flex -space-x-1" aria-label={`${c.sources.length} Quellen`}>
                      {c.sources.map((id) => (
                        <span key={id} className={`size-2.5 rounded-full ring-2 ring-card ${s.dot}`} />
                      ))}
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-ink">{c.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{c.summary}</p>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Sources */}
        <div className="rounded-2xl bg-paper-2 p-4" aria-live="polite">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
            <Quote aria-hidden className="size-3.5" /> Belege · {active.title}
          </p>
          <ul className="mt-3 grid gap-2.5">
            {active.sources.map((id) => {
              const r = responses[id];
              return (
                <li key={id} className="rounded-xl border border-line bg-card p-3">
                  <p className="text-sm leading-relaxed text-ink">„{r.text}“</p>
                  <p className="mt-2 flex items-center gap-2 font-mono text-[11px] text-ink-3">
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
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            Jede Aussage der Karte verweist auf Originalantworten. Pseudonyme, bis jemand dem Klarnamen zustimmt.
          </p>
        </div>
      </div>
    </div>
  );
}
