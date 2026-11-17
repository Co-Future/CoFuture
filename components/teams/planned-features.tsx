import {
  BookOpen,
  CalendarClock,
  Gavel,
  Globe,
  Headset,
  ListChecks,
  Mail,
  MessagesSquare,
  Smile,
  type LucideIcon,
} from "lucide-react";

type Phase = "mvp" | "later";

type PlannedFeature = {
  title: string;
  description: string;
  phase: Phase;
  Icon: LucideIcon;
};

// Mirrors the scope in CLAUDE.md (MVP + MoSCoW). Remove an entry once the feature ships.
const features: PlannedFeature[] = [
  {
    title: "Beschlüsse",
    description: "Aus einer Runde wird ein Beschluss mit Begründung, der an alle im Team geht.",
    phase: "mvp",
    Icon: Gavel,
  },
  {
    title: "Wissensspeicher",
    description: "Beschlüsse und Antworten bleiben auffindbar, auch mit Suche nach Bedeutung statt nur nach Wörtern.",
    phase: "mvp",
    Icon: BookOpen,
  },
  {
    title: "Rückkanal",
    description: "Fragen und Hinweise an die Leitung, auf Wunsch pseudonym. Antworten sehen alle.",
    phase: "mvp",
    Icon: MessagesSquare,
  },
  {
    title: "Statusrunden",
    description: "Kurze, wiederkehrende Runden zu Fristen und offenen Aufgaben.",
    phase: "later",
    Icon: ListChecks,
  },
  {
    title: "Besprechungen",
    description: "Interne und externe Termine vor- und nachbereiten, mit Zusammenfassung und Aufgaben.",
    phase: "later",
    Icon: CalendarClock,
  },
  {
    title: "E-Mail-Zusammenfassung",
    description: "Lange E-Mail-Verläufe kurz zusammengefasst, mit Verweis auf die Original-Nachrichten.",
    phase: "later",
    Icon: Mail,
  },
  {
    title: "Kundenkontakt",
    description: "Kundenanliegen gesammelt an einem Ort, damit das Team gemeinsam antworten kann.",
    phase: "later",
    Icon: Headset,
  },
  {
    title: "Webseiten-Anfragen",
    description: "Anfragen über die Webseite landen strukturiert im Team.",
    phase: "later",
    Icon: Globe,
  },
  {
    title: "Stimmungsbild",
    description: "Anonymes Bild für das Team als Ganzes. Keine Auswertung einzelner Personen.",
    phase: "later",
    Icon: Smile,
  },
];

const phaseLabel: Record<Phase, string> = {
  mvp: "In Arbeit",
  later: "Geplant",
};

export function PlannedFeatures() {
  return (
    <section aria-labelledby="planned-heading">
      <h2 id="planned-heading" className="text-h2">
        Kommt noch
      </h2>
      <p className="mt-1 mb-4 max-w-[680px] text-body-sm text-ink-muted">
        Diese Funktionen sind geplant und noch nicht nutzbar. So siehst du schon jetzt, wohin CoFuture wächst.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, description, phase, Icon }) => (
          <li
            key={title}
            className="flex flex-col gap-2 rounded-lg border border-dashed border-line bg-paper p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-h3 text-ink-muted">
                <Icon size={20} strokeWidth={1.75} aria-hidden />
                {title}
              </span>
              <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-body-sm text-ink-muted">
                {phaseLabel[phase]}
              </span>
            </div>
            <p className="text-body-sm text-ink-muted">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
