import {
  BookOpen,
  CalendarClock,
  Globe,
  Headset,
  ListChecks,
  Mail,
  MessagesSquare,
  Smile,
  type LucideIcon,
} from "lucide-react";

type Phase = "mvp" | "later";

export type PlannedFeature = {
  id: string;
  title: string;
  description: string;
  phase: Phase;
  Icon: LucideIcon;
  /** What the feature will do, in the order we plan to build it. */
  functions: string[];
  /** How it runs on our stack only (Vercel + Supabase + existing AI adapters). */
  stack: string;
};

// Same content as docs/roadmap.md. Remove an entry once the feature ships.
export const plannedFeatures: PlannedFeature[] = [
  {
    id: "wissensspeicher",
    title: "Fragen an den Wissen-Bereich",
    description: "Suche und Speicher sind unter „Wissen“ da. Als Nächstes: eine Frage stellen und eine Antwort mit Belegen bekommen.",
    phase: "mvp",
    Icon: BookOpen,
    functions: [
      "Frage in eigenen Worten stellen, AsyncMeet antwortet aus dem Wissensspeicher",
      "Jede Aussage der Antwort mit Link zur Quelle, Aussagen ohne Quelle werden verworfen",
      "Findet AsyncMeet nichts, sagt es das, statt etwas zu erfinden",
      "Sichtbar nur, was du auch im Original sehen darfst",
    ],
    stack: "Hybridsuche search_knowledge(), Antwort über lib/ai mit Structured Output und Quellenprüfung",
  },
  {
    id: "rueckkanal",
    title: "Rückkanal",
    description: "Fragen und Hinweise an die Leitung, auf Wunsch pseudonym. Antworten sehen alle.",
    phase: "mvp",
    Icon: MessagesSquare,
    functions: [
      "Frage oder Hinweis an die Leitung, pseudonym oder mit Namen",
      "Antworten der Leitung sind für alle im Team sichtbar",
      "Ähnliche Fragen werden gebündelt, mit Quellen",
      "Briefings der Leitung mit Rückfragen",
      "Status offen oder beantwortet",
    ],
    stack: "Tabellen threads und messages mit RLS, Pseudonym-Trigger wie bei Antworten, Realtime",
  },
  {
    id: "statusrunden",
    title: "Statusrunden",
    description: "Kurze, wiederkehrende Runden zu Fristen und offenen Aufgaben.",
    phase: "later",
    Icon: ListChecks,
    functions: [
      "Wiederkehrende Kurzrunde mit festen Fragen, zum Beispiel montags 9:00 Uhr",
      "Erinnerung im Dashboard unter „Wartet auf deine Antwort“",
      "Zusammenfassung zu Fortschritt, Blockern und Fristen",
      "Offene Aufgaben mit Frist",
    ],
    stack: "pg_cron legt die Runden an, bestehende Runden- und Analyse-Jobs",
  },
  {
    id: "besprechungen",
    title: "Besprechungen",
    description: "Interne und externe Termine vor- und nachbereiten, mit Zusammenfassung und Aufgaben.",
    phase: "later",
    Icon: CalendarClock,
    functions: [
      "Termin mit Agenda, die alle vorher ergänzen können",
      "Aufnahme im Browser oder als Datei hochladen, danach Transkript",
      "Zusammenfassung, Beschlüsse und Aufgaben mit Zeitmarke als Quelle",
      "Protokoll für alle Teilnehmenden in der App",
      "Externe Gäste per Zugangslink nur für diese Besprechung",
    ],
    stack: "Upload direkt in Supabase Storage, Transkription in Abschnitten im Job-Worker (lib/stt), Realtime",
  },
  {
    id: "e-mail",
    title: "E-Mail-Zusammenfassung",
    description: "Lange E-Mail-Verläufe kurz zusammengefasst, mit Verweis auf die Original-Nachrichten.",
    phase: "later",
    Icon: Mail,
    functions: [
      "E-Mail-Verlauf einfügen oder als .eml-Datei hochladen",
      "Zusammenfassung, offene Fragen, Fristen",
      "Antwortentwurf zum Bearbeiten",
      "Mit Kunde oder Team verknüpfen",
    ],
    stack: "Einfügen oder Upload, Auswertung als Job über lib/ai. Kein Postfach-Abruf, Weiterleitungsadresse erst mit Resend",
  },
  {
    id: "kundenkontakt",
    title: "Kundenkontakt",
    description: "Kundenanliegen gesammelt an einem Ort, damit das Team gemeinsam antworten kann.",
    phase: "later",
    Icon: Headset,
    functions: [
      "Kundenkartei je Organisation",
      "Verlauf mit Anfragen, E-Mails und Besprechungen an einem Ort",
      "Anfrage einem Team zuweisen, Status verfolgen",
      "Zusammenfassung der Kundenhistorie mit Quellen",
      "Kundendaten auf Wunsch vollständig löschen",
    ],
    stack: "Tabellen je Organisation mit RLS, Zusammenfassung als Job über lib/ai",
  },
  {
    id: "webseiten-anfragen",
    title: "Webseiten-Anfragen",
    description: "Anfragen über die Webseite landen strukturiert im Team.",
    phase: "later",
    Icon: Globe,
    functions: [
      "Öffentliches Anfrageformular je Organisation, als Link oder eingebettet",
      "Eingang mit Kategorie, Dringlichkeit und Kurzfassung",
      "Spamschutz über Honeypot und Ratenlimit",
      "Landet im Kundenkontakt und wird einem Team zugewiesen",
    ],
    stack: "Öffentlicher Route Handler mit Zod, Tabelle ohne Client-Zugriff, Ratenlimit in Postgres",
  },
  {
    id: "stimmungsbild",
    title: "Stimmungsbild",
    description: "Anonymes Bild für das Team als Ganzes. Keine Auswertung einzelner Personen.",
    phase: "later",
    Icon: Smile,
    functions: [
      "Kurze anonyme Abfrage mit Skala und optionalem Text",
      "Ergebnis erst ab 5 Antworten sichtbar",
      "Verlauf über die Zeit für das ganze Team",
      "Gleiche Sicht für alle, keine Auswertung einzelner Personen",
    ],
    stack: "Tabelle mit RLS und View ohne Personenbezug (wie round_responses), pg_cron für Wiederholungen",
  },
];

export const phaseLabel: Record<Phase, string> = {
  mvp: "In Arbeit",
  later: "Geplant",
};

export function PlannedFeatures({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  return (
    <section aria-labelledby="planned-heading">
      <Heading id="planned-heading" className={headingLevel === "h1" ? "text-h1" : "text-h2"}>
        Kommt noch
      </Heading>
      <p className="mt-1 mb-6 max-w-[680px] text-body text-ink-muted">
        Diese Funktionen sind geplant und noch nicht nutzbar. Alle laufen auf derselben Grundlage wie heute: Vercel und Supabase.
      </p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {plannedFeatures.map(({ id, title, description, phase, Icon, functions, stack }) => (
          <li
            key={id}
            id={id}
            className="flex scroll-mt-24 flex-col gap-3 rounded-lg border border-dashed border-line bg-paper p-4 target:border-primary"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-h3">
                <Icon size={20} strokeWidth={1.75} aria-hidden />
                {title}
              </span>
              <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-body-sm text-ink-muted">{phaseLabel[phase]}</span>
            </div>
            <p className="text-body text-ink-muted">{description}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm">
              {functions.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="text-body-sm text-ink-muted">
              <span className="font-semibold text-ink">Umsetzung: </span>
              {stack}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
