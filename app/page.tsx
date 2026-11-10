import {
  ArrowRight,
  ArrowRightLeft,
  BookOpen,
  FileText,
  Gavel,
  Globe,
  Headset,
  Mail,
  Mic,
  Network,
  ScanSearch,
  Scale,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { PerspectiveMap } from "@/components/perspective-map";

const ICON = { strokeWidth: 1.75, "aria-hidden": true } as const;

const steps = [
  { icon: Mic, title: "Frage stellen", text: "Eine Frage oder Entscheidungsvorlage geht als Runde mit Frist an das Team." },
  {
    icon: Users,
    title: "Beitrag geben, wann es passt",
    text: "Alle antworten per Sprache oder Text. Die Aufnahme wird transkribiert und danach gelöscht.",
  },
  {
    icon: Sparkles,
    title: "Perspektiven sehen",
    text: "AsyncMeet ordnet alle Beiträge nach Konsens, Dissens und Einzelstimmen, jede Aussage mit Beleg.",
  },
  {
    icon: Gavel,
    title: "Gemeinsam entscheiden",
    text: "Rückfragen und Folgerunden führen zum Beschluss. Die Begründung geht an alle zurück.",
  },
];

const principles = [
  { icon: Scale, title: "Gleiche Sicht für alle", text: "Keine Auswertungen, die nur Führungskräfte sehen." },
  { icon: UserRoundCheck, title: "Inhalte, nicht Personen", text: "AsyncMeet prüft Fristen und Aufgaben, bewertet aber niemanden." },
  { icon: Network, title: "Minderheiten sichtbar", text: "Einzelstimmen werden markiert, nicht herausgemittelt." },
  { icon: ScanSearch, title: "Belegbar", text: "Jede Zusammenfassung verweist auf die Beiträge, aus denen sie stammt." },
  { icon: Gavel, title: "Menschen entscheiden", text: "AsyncMeet bereitet vor, Team und Führung beschließen." },
  { icon: ShieldCheck, title: "Daten bleiben in der EU", text: "DSGVO-konform, Pseudonym als Standard." },
];

const modules = [
  { icon: Sparkles, title: "AsyncMeet", text: "Abstimmungsrunden mit Perspektivenkarte", stage: "MVP" },
  { icon: BookOpen, title: "Wissensspeicher", text: "Semantische Suche mit Quellenangabe", stage: "MVP" },
  { icon: ArrowRightLeft, title: "Rückkanal", text: "Führung und Mitarbeitende, Schleife schließen", stage: "MVP" },
  { icon: FileText, title: "Besprechungen", text: "Zusammenfassung, Beschlüsse, Protokoll", stage: "Später" },
  { icon: Mail, title: "E-Mails", text: "Priorisieren, zusammenfassen, Antwort entwerfen", stage: "Später" },
  { icon: Headset, title: "Kundenkontakt", text: "Anfragen mit Kundenhistorie verknüpfen", stage: "Später" },
  { icon: Globe, title: "Webseite", text: "Chat und Formular übergeben strukturiert", stage: "Später" },
];

function Waveform() {
  const heights = [10, 22, 34, 18, 40, 28, 14, 36, 24, 12, 30, 20, 38, 16];
  return (
    <div className="flex h-10 items-center gap-[3px]" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="wave-bar w-[3px] rounded-full bg-primary"
          style={{ height: h, animationDelay: `${(i % 7) * 0.12}s` }}
        />
      ))}
    </div>
  );
}

/** Brand cover motif: four blocks, the logo ring cut into the primary block. */
function CoverMotif() {
  return (
    <svg viewBox="0 0 480 288" className="h-auto w-full" aria-hidden>
      <rect x="0" y="0" width="240" height="192" rx="12" fill="var(--primary)" />
      <rect x="252" y="0" width="228" height="144" rx="12" fill="var(--ink)" />
      <rect x="252" y="156" width="228" height="132" rx="12" fill="var(--accent)" />
      <rect x="0" y="204" width="240" height="84" rx="12" fill="var(--primary-soft)" />
      <path d="M162.13 60.65A55 55 0 1 0 162.13 131.35" fill="none" stroke="var(--paper)" strokeWidth="20" strokeLinecap="round" />
      <circle cx="170" cy="96" r="14" fill="var(--accent)" />
      <path d="M480 144L480 48A96 96 0 0 0 384 144Z" fill="var(--primary)" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <nav className="mx-auto flex max-w-[1216px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-12">
          <a href="#" aria-label="CoFuture Startseite">
            <Logo fontSize={20} />
          </a>
          <div className="hidden items-center gap-6 text-label text-ink-muted md:flex">
            <a href="#ablauf" className="hover:text-ink">Ablauf</a>
            <a href="#demo" className="hover:text-ink">Perspektivenkarte</a>
            <a href="#prinzipien" className="hover:text-ink">Prinzipien</a>
            <a href="#module" className="hover:text-ink">Module</a>
          </div>
          <a
            href="#demo"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-label text-on-primary transition-colors hover:bg-primary-hover"
          >
            Demo ansehen
          </a>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-[1216px] gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.15fr_1fr] md:items-center lg:px-12 lg:py-24">
          <div>
            <p className="text-caption text-ink-muted">Zusammenarbeit neu denken. Mit KI.</p>
            <h1 className="mt-4 text-[40px] leading-[44px] font-extrabold tracking-[-0.02em] [font-family:var(--font-display)] sm:text-display">
              Entscheidungen, die alle verstehen.
            </h1>
            <p className="mt-6 max-w-[560px] text-body-lg text-ink-muted">
              CoFuture hilft Teams, Entscheidungen gemeinsam und asynchron zu treffen. AsyncMeet sammelt Perspektiven
              per Sprache oder Text und fasst sie nachvollziehbar zusammen. Entscheiden tun Menschen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#ablauf"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-body font-semibold text-on-primary transition-colors hover:bg-primary-hover"
              >
                Ablauf ansehen <ArrowRight {...ICON} className="size-[18px]" />
              </a>
              <a
                href="#prinzipien"
                className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-card px-5 text-body font-semibold text-ink transition-colors hover:bg-primary-soft"
              >
                Prinzipien lesen
              </a>
            </div>
          </div>

          <div className="relative pb-24 sm:pb-16">
            <CoverMotif />
            {/* Voice card */}
            <div className="absolute bottom-0 left-0 right-6 rounded-lg border border-line bg-card p-4 shadow-overlay sm:right-auto sm:w-[340px]">
              <p className="text-caption text-ink-muted">Dein Beitrag · Runde 12</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary">
                  <Mic {...ICON} className="size-5" />
                </span>
                <Waveform />
                <span className="ml-auto font-mono text-sm text-ink-muted tabular-nums">0:42</span>
              </div>
              <p className="mt-3 text-body-sm text-ink-muted">Transkript prüfen, dann senden. Die Aufnahme wird danach gelöscht.</p>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="ablauf" className="scroll-mt-20 border-y border-line bg-sunken">
          <div className="mx-auto max-w-[1216px] px-4 py-16 sm:px-6 lg:px-12">
            <p className="text-caption text-ink-muted">AsyncMeet</p>
            <h2 className="mt-2 max-w-[680px] text-h1">Abstimmen ohne Meeting. Jede Stimme zählt gleich.</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <s.icon {...ICON} className="size-5 text-primary" />
                    <span className="font-mono text-xs text-ink-muted">0{i + 1}</span>
                  </div>
                  <h3 className="text-h3">{s.title}</h3>
                  <p className="text-body-sm text-ink-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-20">
          <div className="mx-auto grid max-w-[1216px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.75fr_1.6fr] lg:items-start lg:px-12">
            <div className="lg:sticky lg:top-24">
              <p className="text-caption text-ink-muted">Perspektivenkarte</p>
              <h2 className="mt-2 text-h1">Was das Team denkt, auf einen Blick.</h2>
              <p className="mt-4 text-body-lg text-ink-muted">
                Statt eines Durchschnitts zeigt die Karte, wo alle übereinstimmen, wo es Spannungen gibt und welche
                Einzelstimme einen neuen Weg vorschlägt.
              </p>
              <p className="mt-4 text-body-sm text-ink-muted">Wähle einen Filter und eine Perspektive, um die Belege zu sehen.</p>
            </div>
            <PerspectiveMap />
          </div>
        </section>

        {/* Principles */}
        <section id="prinzipien" className="scroll-mt-20 bg-primary text-on-primary">
          <div className="mx-auto max-w-[1216px] px-4 py-16 sm:px-6 lg:px-12">
            <p className="text-caption opacity-80">Selbstorganisation statt Kontrolle</p>
            <h2 className="mt-2 max-w-[680px] text-h1">KI, die Zusammenarbeit stärkt und niemanden überwacht.</h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {principles.map((p) => (
                <li key={p.title} className="flex flex-col gap-3 rounded-lg bg-card p-4 text-ink shadow-card">
                  <span className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
                    <p.icon {...ICON} className="size-5" />
                  </span>
                  <h3 className="text-h3">{p.title}</h3>
                  <p className="text-body-sm text-ink-muted">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Modules */}
        <section id="module" className="scroll-mt-20">
          <div className="mx-auto max-w-[1216px] px-4 py-16 sm:px-6 lg:px-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-caption text-ink-muted">Eine Plattform</p>
                <h2 className="mt-2 text-h1">Von der Runde bis zum Kunden.</h2>
              </div>
              <p className="flex items-center gap-2 text-body-sm text-ink-muted">
                <span className="rounded-full bg-success-soft px-2.5 py-[3px] text-xs font-semibold text-success-ink">MVP</span>
                bis 05.02.2027
                <span className="ml-3 rounded-full border border-line bg-sunken px-2.5 py-[3px] text-xs font-semibold text-ink">Später</span>
                nach Priorität
              </p>
            </div>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((m) => (
                <li key={m.title} className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <m.icon {...ICON} className="size-5 text-primary" />
                    <span
                      className={`rounded-full px-2.5 py-[3px] text-xs font-semibold ${
                        m.stage === "MVP" ? "bg-success-soft text-success-ink" : "border border-line bg-sunken text-ink"
                      }`}
                    >
                      {m.stage}
                    </span>
                  </div>
                  <h3 className="text-h3">{m.title}</h3>
                  <p className="text-body-sm text-ink-muted">{m.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-sunken">
        <div className="mx-auto flex max-w-[1216px] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6 lg:px-12">
          <Logo fontSize={18} />
          <p className="text-body-sm text-ink-muted">Seminarprojekt 2026/27 · AsyncMeet fasst zusammen, Menschen entscheiden.</p>
        </div>
      </footer>
    </div>
  );
}
