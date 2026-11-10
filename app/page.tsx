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
import { PerspectiveMap } from "@/components/perspective-map";

const steps = [
  {
    icon: Mic,
    title: "Frage stellen",
    text: "Eine Frage oder Entscheidungsvorlage geht als Runde mit Frist an das Team.",
  },
  {
    icon: Users,
    title: "Antworten, wann es passt",
    text: "Alle antworten per Sprache oder Text. Die Sprachantwort wird transkribiert, die Audiodatei danach gelöscht.",
  },
  {
    icon: Sparkles,
    title: "Perspektiven sichtbar machen",
    text: "Die KI ordnet alle Antworten: Konsens, Dissens, Einzelstimmen. Jede Aussage mit Beleg.",
  },
  {
    icon: Gavel,
    title: "Gemeinsam entscheiden",
    text: "Rückfragen und Folgerunden führen zum Beschluss, der mit Begründung an alle zurückgeht.",
  },
];

const principles = [
  { icon: Scale, title: "Gleiche Sicht für alle", text: "Keine Sonderauswertungen nur für Führungskräfte." },
  { icon: UserRoundCheck, title: "Inhalte, nicht Personen", text: "Die KI prüft Fristen und Aufgaben, bewertet aber niemanden." },
  { icon: Network, title: "Minderheiten sichtbar", text: "Einzelstimmen werden markiert statt herausgemittelt." },
  { icon: ScanSearch, title: "Belegbar", text: "Jede KI-Aussage verweist auf die Originalquelle." },
  { icon: Gavel, title: "Mensch entscheidet", text: "Die KI bereitet vor, Team und Führung beschließen." },
  { icon: ShieldCheck, title: "Daten bleiben in der EU", text: "DSGVO-konform, Pseudonym als Standard." },
];

const modules = [
  { icon: Sparkles, title: "AsyncMeet", text: "Abstimmungsrunden mit Perspektivenkarte", stage: "MVP" },
  { icon: BookOpen, title: "Wissensspeicher", text: "Semantische Suche mit Quellenangabe", stage: "MVP" },
  { icon: ArrowRightLeft, title: "Rückkanal", text: "Führung ↔ Mitarbeitende, Schleife schließen", stage: "MVP" },
  { icon: FileText, title: "Besprechungen", text: "Zusammenfassung, Beschlüsse, Protokoll", stage: "Danach" },
  { icon: Mail, title: "E-Mails", text: "Priorisieren, zusammenfassen, Antwortentwürfe", stage: "Danach" },
  { icon: Headset, title: "Kundenkontakt", text: "Anfragen mit Kundenhistorie verknüpfen", stage: "Danach" },
  { icon: Globe, title: "Webseite", text: "Chat und Formular übergeben strukturiert", stage: "Danach" },
];

function Waveform() {
  const heights = [10, 22, 34, 18, 40, 28, 14, 36, 24, 12, 30, 20, 38, 16, 26, 10];
  return (
    <div className="flex h-12 items-center gap-[3px]" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="wave-bar w-[3px] rounded-full bg-accent"
          style={{ height: h, animationDelay: `${(i % 8) * 0.11}s` }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#" className="flex items-center gap-2 font-display text-xl tracking-tight">
            <span className="grid size-7 place-items-center rounded-full bg-ink text-paper">
              <span className="block size-2.5 rounded-full bg-accent" />
            </span>
            CoFuture
          </a>
          <div className="hidden items-center gap-6 text-sm text-ink-2 sm:flex">
            <a href="#ablauf" className="hover:text-ink">Ablauf</a>
            <a href="#demo" className="hover:text-ink">Perspektivenkarte</a>
            <a href="#prinzipien" className="hover:text-ink">Prinzipien</a>
            <a href="#module" className="hover:text-ink">Module</a>
          </div>
          <a
            href="#demo"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90"
          >
            Demo ansehen
          </a>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="grain pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 md:grid-cols-[1.25fr_1fr] md:items-center md:pt-24">
            <div className="rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-ink-2">
                <span className="size-1.5 rounded-full bg-sage" /> Seminar „Zurück in die Digitale Zukunft“
              </p>
              <h1 className="mt-6 font-display text-[2.6rem] leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                Zusammenarbeit
                <br />
                neu denken.{" "}
                <em className="whitespace-nowrap font-normal text-accent [font-variation-settings:'SOFT'_100]">Mit KI.</em>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
                CoFuture sammelt Perspektiven per Sprache oder Text, macht Konsens, Dissens und leise Stimmen
                sichtbar und belegt jede Aussage. Die KI bereitet vor. <strong className="font-semibold text-ink">Menschen entscheiden.</strong>
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#ablauf"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-white transition hover:brightness-110"
                >
                  So funktioniert’s <ArrowRight aria-hidden className="size-4" />
                </a>
                <a
                  href="#prinzipien"
                  className="rounded-full border border-line px-5 py-3 font-medium text-ink transition hover:border-ink-3"
                >
                  Unsere Prinzipien
                </a>
              </div>
            </div>

            {/* Voice card */}
            <div className="rise [animation-delay:150ms]">
              <div className="relative rounded-3xl border border-line bg-card p-6 shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--ink)_30%,transparent)]">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Deine Antwort · Runde #12</p>
                <p className="mt-2 font-display text-xl leading-snug">
                  Sollen wir im Sommer auf eine 4-Tage-Woche umstellen?
                </p>
                <div className="mt-6 flex items-center gap-4 rounded-2xl bg-paper-2 p-4">
                  <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-accent text-white">
                    <span className="absolute inset-0 animate-ping rounded-full bg-accent/30 motion-reduce:hidden" />
                    <Mic aria-hidden className="relative size-5" />
                  </span>
                  <Waveform />
                  <span className="ml-auto font-mono text-sm text-ink-2">0:42</span>
                </div>
                <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm leading-relaxed text-ink-2">
                  „Grundsätzlich ja, aber nur wenn der Support jeden Tag erreichbar bleibt …“
                  <span className="mt-2 block font-mono text-[11px] text-ink-3">Transkript · korrigierbar · Audio wird gelöscht</span>
                </p>
                <div className="absolute -bottom-5 -left-4 hidden rotate-[-3deg] rounded-2xl border border-line bg-card px-4 py-3 text-sm shadow-lg sm:block">
                  <span className="font-display text-2xl text-sage">9/9</span>
                  <span className="ml-2 text-ink-2">Antworten in der Karte</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="ablauf" className="scroll-mt-20 border-y border-line bg-paper-2">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-sm font-medium text-accent">AsyncMeet</p>
            <h2 className="mt-2 max-w-2xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              Abstimmung ohne Meeting. Beteiligung ohne Lautstärke.
            </h2>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-3xl border border-line bg-card p-6">
                  <div className="flex items-center justify-between">
                    <s.icon aria-hidden className="size-6 text-accent" />
                    <span className="font-mono text-sm text-ink-3">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Demo */}
        <section id="demo" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.6fr] lg:items-start">
              <div className="lg:sticky lg:top-24">
                <p className="text-sm font-medium text-accent">Perspektivenkarte</p>
                <h2 className="mt-2 font-display text-4xl leading-tight tracking-tight">
                  Was das Team denkt, auf einen Blick.
                </h2>
                <p className="mt-4 leading-relaxed text-ink-2">
                  Statt einer Durchschnittsmeinung zeigt die Karte, wo sich alle einig sind, wo es Spannungen gibt
                  und welche Einzelstimme vielleicht die beste Idee hat.
                </p>
                <p className="mt-4 text-sm text-ink-3">Probier es aus: Filter wählen und eine Karte anklicken.</p>
              </div>
              <PerspectiveMap />
            </div>
          </div>
        </section>

        {/* Principles */}
        <section id="prinzipien" className="scroll-mt-20 bg-ink text-paper">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-sm font-medium text-accent">Selbstorganisation statt Kontrollmaschine</p>
            <h2 className="mt-2 max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              KI, die Zusammenarbeit stärkt, nicht überwacht.
            </h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-paper/15 sm:grid-cols-2 lg:grid-cols-3">
              {principles.map((p) => (
                <li key={p.title} className="bg-ink p-6">
                  <p.icon aria-hidden className="size-5 text-accent" />
                  <h3 className="mt-4 font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-paper/70">{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Modules */}
        <section id="module" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-accent">Eine Plattform</p>
                <h2 className="mt-2 font-display text-4xl leading-tight tracking-tight">Von der Runde bis zum Kunden.</h2>
              </div>
              <p className="flex items-center gap-4 text-sm text-ink-2">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sage" /> MVP</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-gold" /> Danach</span>
              </p>
            </div>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((m) => (
                <li
                  key={m.title}
                  className="group rounded-2xl border border-line bg-card p-5 transition hover:-translate-y-0.5 hover:border-ink-3"
                >
                  <div className="flex items-center justify-between">
                    <m.icon aria-hidden className="size-5 text-ink-2 transition group-hover:text-accent" />
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        m.stage === "MVP" ? "bg-sage-soft text-sage" : "bg-gold-soft text-gold"
                      }`}
                    >
                      {m.stage}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{m.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{m.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-ink-3 sm:px-6">
          <p>
            <span className="font-display text-ink">CoFuture</span> · Seminarprojekt 2026/27
          </p>
          <p>Die KI bereitet vor. Menschen entscheiden.</p>
        </div>
      </footer>
    </div>
  );
}
