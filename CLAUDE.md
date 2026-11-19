# CLAUDE.md – CoFuture

Kontext und Regeln für Claude Code und alle im Team. Die Datei liegt im Repo, damit alle mit denselben Regeln arbeiten. Persönliche Einstellungen gehören in `CLAUDE.local.md` oder `.claude/settings.local.json` (beide ignoriert).

@AGENTS.md

## Projekt

CoFuture ist eine KI-Plattform für Kommunikation und Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden. Die KI fasst zusammen, strukturiert und belegt. **Menschen entscheiden.**

- **Quelle der Wahrheit:** die [`README.md`](README.md) für Ziel, Scope, Stand und offene Aufgaben, die Doku in [`docs/`](docs/README.md) für alles Technische. Jede Information steht an genau einem Ort ([Wo steht was](docs/README.md#wo-steht-was)). Es gibt kein separates Planungstool. Wenn Code und Doku sich widersprechen, nachfragen statt raten.
- **Doku aktuell halten:** siehe [Dokumentation und Versionen](#dokumentation-und-versionen-pflicht). Gilt für jeden PR, auch für Claude Code.
- **Abgabe:** 05.02.2027, lauffähige Plattform, kein Klickprototyp. Seminar „Zurück in die Digitale Zukunft“.
- **Kernfeature AsyncMeet:** Austausch mit einer oder mehreren Fragen → Antworten per Sprache oder Text → Transkription → Perspektivenkarte je Frage mit Quellen → Beschluss ([Ablauf](docs/architecture.md#ablauf-eines-austauschs)).

## Gestaltungsprinzipien (nicht verhandelbar)

Gelten für jedes Feature. Verstößt eine Umsetzung dagegen, darauf hinweisen.

- **Gleiche Sicht für alle.** Keine Auswertungen nur für Führungskräfte oder Admins. Rollen ändern, was man tun darf, nie was man sieht. Ausnahme (ADR 012): Fragen nur für bestimmte Personen und Rückfragen sehen nur die Beteiligten und wer den Austausch gestartet hat.
- **Inhalte bewerten, keine Personen.** Die KI prüft Fristen, Vollständigkeit, offene Aufgaben, nie die Leistung einzelner.
- **Pseudonym als Standard.** Klarnamen nur nach Zustimmung. Im Austausch zeigt die App den selbst gewählten Anzeigenamen statt A01 (ADR 012). An die KI gehen weiter nur Pseudonyme.
- **Minderheiten sichtbar.** Einzelstimmen markieren, nicht herausmitteln.
- **Belegbar.** Jede KI-Aussage hat mindestens eine Quell-ID, sonst wird sie verworfen.
- **Mensch entscheidet.** Die KI bereitet vor, sie beschließt nichts.
- **Datensparsam.** An die KI gehen nur Pseudonyme und Texte, keine E-Mail-Adressen. Alle Daten in der EU.

## Tech-Stack

Einzige Quelle ist [`docs/tech-stack.md`](docs/tech-stack.md), hier eingebunden. Nicht hier ändern, sondern dort, mit Zeile im Änderungsprotokoll. Architektur mit Schaubildern: [`docs/architecture.md`](docs/architecture.md). Entscheidungen stehen als ADR in [`docs/adr/`](docs/adr/). Eine ADR gilt, sobald Constantin oder Luca sie freigeben.

@docs/tech-stack.md

## Designsprache

Quelle: Artefakt „CoFuture Designsprache“ (https://claude.ai/artifact/8MjwoAq9R8sXvAaSgC8Fbj). Tokens in `app/globals.css`, als Tailwind-Klassen nutzbar (`bg-paper`, `text-ink-muted`, `bg-primary`, `text-h1` …).

- **Ton:** Du-Ansprache, kurze konkrete Sätze. Keine Superlative, keine Emojis, kein Ausrufezeichen. Buttons: Verb + Objekt („Runde starten“), nie „OK“ oder „Absenden“.
- **KI ist Werkzeug:** „AsyncMeet fasst zusammen“, nie „Die KI entscheidet“. Jede Zusammenfassung zeigt ihre Quellen.
- **Schreibweisen:** `10.11.2026`, `12:00 Uhr`, `15 €`, Dezimalkomma. Produktnamen exakt: **CoFuture**, **AsyncMeet**.
- **Farben:** nur Tokens, nie Hex-Werte in Komponenten. `primary` für Hauptaktion, Links, Fokus. `accent` nur als Fläche oder Punkt, nie als Textfarbe, höchstens eine Akzent-Aktion je Ansicht. Status (`success`, `warning`, `danger`) immer mit Wort oder Icon. Kategorien `cat-blau`, `cat-orange`, `cat-teal`, `cat-pflaume`, `cat-gold`, `cat-schiefer` in dieser Reihenfolge, nur für Punkte und Flächen.
- **Schrift:** Manrope (`font-display`) für Überschriften, Source Sans 3 (`font-sans`) für Text, JetBrains Mono (`font-mono`) für IDs. Skala `text-display` bis `text-caption`. Fließtext nie unter 14 px.
- **Form:** 4-px-Raster. `rounded-md` (Buttons, Felder), `rounded-lg` (Karten, Dialoge), `rounded-full` (Badges). Schatten nur `shadow-card` und `shadow-overlay`. Keine Verläufe, keine farbigen Schatten, keine farbigen Randstreifen.
- **Layout:** Seitenleiste links (`components/app-shell/`), Inhalt max. 1120 px, Lesebreite max. 680 px, mobil zuerst, Touch-Ziele mindestens 44 px.
- **Icons:** nur `lucide-react`, `strokeWidth={1.75}`, 20 px in Oberflächen, 16 px in Badges. Icon immer mit Text, sonst `aria-label`.
- **Logo:** `components/logo.tsx`. Nie umfärben, nie unter 16 px, nie auf `accent`-Fläche.
- **Barrierefreiheit:** Kontrast ≥ 4,5:1, sichtbarer Fokus, Zustände nie nur über Farbe, keine Animation bei `prefers-reduced-motion`.

## Zusammenarbeit

Fünf Leute arbeiten parallel im Repo, oft mit Claude Code.

### Branches und Commits

- **Nie direkt auf `main` pushen.** `main` ist immer lauffähig und geht automatisch live.
- Ein Branch je Aufgabe von aktuellem `main`: `feat/…`, `fix/…`, `chore/…`, `docs/…`. Roadmap-Schritte mit Nummer, z. B. `feat/7-beschluesse`.
- Vor dem Start und vor dem PR: `git pull --rebase origin main`.
- [Conventional Commits](https://www.conventionalcommits.org/de/), kleine, in sich geschlossene Commits.

### Pull Requests und Freigaben

- Jede Änderung über einen PR mit Vorlage: was, warum, wie getestet, Screenshot bei UI.
- **Freigabe:** Ein OK von Constantin oder Luca genügt, auch beim eigenen PR. Das gilt auch für ADRs und Regeländerungen.
- Gemergt wird nach dem OK und mit grüner CI (`lint`, `typecheck`, `test`, `build`). Squash-Merge, Branch löschen.
- PRs klein halten, Richtwert unter 400 geänderte Zeilen.
- Bauen PRs aufeinander auf: den ältesten zuerst mergen und den nächsten danach auf `main` umstellen, bevor der Basis-Branch gelöscht wird.

### Konflikte vermeiden

- **Migrationen:** eine pro PR, neue Datei mit Zeitstempel, bestehende nie ändern. Vor dem Merge auf Staging einspielen. Vergibt Supabase eine andere Version, die Datei darauf umbenennen.
- **Prompts:** neue Version (`prompts/v2/…`), alte nie überschreiben.
- **Geteilte Dateien** (`app/layout.tsx`, `app/globals.css`, `lib/validation/`, `components/app-shell/`): Änderungen kurz ankündigen.
- `pnpm-lock.yaml` nie von Hand bearbeiten. Bei Konflikten `main` übernehmen und `pnpm install` laufen lassen.

### Secrets

- Keine Schlüssel, Tokens oder echten Personendaten ins Repo, auch nicht in Tests oder Seed-Daten.
- Variablen stehen ohne Werte in `.env.example`, echte Werte in `.env.local` (ignoriert) und in Vercel.

## Dokumentation und Versionen (Pflicht)

Fünf Leute und mehrere Claude-Code-Sitzungen arbeiten parallel. Damit niemand gegen einen veralteten Stand arbeitet, gilt:

- **Im selben PR, nie später.** Wer Code ändert, passt die zugehörige Doku im selben PR an. Welche Datei: Tabelle [Was muss ich anpassen?](docs/README.md#was-muss-ich-anpassen).
- **Ein Ort je Information.** Tech-Stack nur in `docs/tech-stack.md`, Architektur nur in `docs/architecture.md`, geplante Funktionen nur in `docs/roadmap.md`, Stand nur in der README, Änderungen je Version nur im `CHANGELOG.md`. Andere Dateien verlinken, statt zu kopieren.
- **Tech-Stack-Änderungen protokollieren:** jede neue oder entfernte Abhängigkeit, jeder neue Dienst, jedes Major-Update, jeder Anbieter- oder Modellwechsel bekommt eine Zeile im [Änderungsprotokoll](docs/tech-stack.md#änderungsprotokoll). Größere Wechsel brauchen eine ADR.
- **Architektur-Schaubilder pflegen:** neue Tabelle, neuer Job-Typ, neuer KI-Schritt oder geänderter Ablauf → Mermaid-Diagramm in `docs/architecture.md` und dessen Änderungsprotokoll anpassen.
- **Versionen nach [Semantic Versioning](docs/versioning.md):** jeder PR mit Wirkung in der App trägt sich in `CHANGELOG.md` unter `[Unreleased]` ein (Neu, Geändert, Behoben, Entfernt, Sicherheit). Die Version in `package.json` steigt nur im Release-PR (`chore/release-X.Y.Z`), danach Git-Tag `vX.Y.Z`.
- **Die CI prüft** Version, Changelog, Abhängigkeiten, Tabellen und ADR-Übersicht (`pnpm docs:check`, Details in [`docs/versioning.md`](docs/versioning.md#was-die-ci-prüft)).

**Für Claude Code zusätzlich:**

- Vor der Arbeit `docs/README.md` und die betroffenen Doku-Dateien lesen und von aktuellem `origin/main` ausgehen. Steht dort etwas anderes als im Auftrag oder im Code, nachfragen statt eine eigene Variante bauen.
- Vor dem PR die Tabelle *Was muss ich anpassen?* durchgehen und `pnpm docs:check` laufen lassen.
- Am Ende der Arbeit die Links zu den geänderten Doku-Abschnitten nennen.
- Die Version nie selbst erhöhen oder taggen, außer im Release-PR auf ausdrücklichen Wunsch.

## Befehle

```bash
corepack pnpm install     # Abhängigkeiten
corepack pnpm dev         # Dev-Server auf http://localhost:3000
corepack pnpm lint        # ESLint
corepack pnpm typecheck   # Routen-Typen + TypeScript
corepack pnpm test        # Unit-Tests
corepack pnpm build       # Produktions-Build
corepack pnpm docs:check  # Doku, Version und Changelog prüfen
```

Mit `corepack enable` reicht danach `pnpm …`.

### Repo im iCloud-Ordner

iCloud lagert Dateien aus `node_modules` aus, dann hängen Lint und Build. Die echten Ordner heißen `node_modules.nosync` und `.next.nosync` (iCloud ignoriert `.nosync`), `node_modules` und `.next` sind Symlinks darauf:

```bash
rm -rf node_modules .next
mkdir node_modules.nosync .next.nosync
ln -s node_modules.nosync node_modules && ln -s .next.nosync .next
corepack pnpm install
```

Kopien wie `main 2` in `.git/refs/heads/` stammen ebenfalls von iCloud und brechen `git fetch`. Besser: Repo außerhalb von iCloud klonen.

## Hinweise für Claude Code

**Arbeitsweise**

- Vor neuem Next.js-Code die passende Doku in `node_modules/next/dist/docs/` lesen (siehe AGENTS.md).
- Erst einen Branch anlegen, nie auf `main` arbeiten. Nicht selbstständig mergen oder force-pushen. Mergen erst, wenn Constantin oder Luca im Chat oder im PR OK gegeben haben.
- Bestehende Muster übernehmen statt neue Bibliotheken einführen. Neue Abhängigkeiten im PR begründen.
- KI-Aufrufe nur über `lib/ai/` und `lib/stt/`, nie aus Komponenten. Schwere Arbeit als Job, nie im Request.
- Jede KI-Ausgabe per Zod validieren, Aussagen ohne Quell-ID verwerfen. An Gratis-Tarife nur ausgedachte Testdaten.
- UI-Texte auf Deutsch, Code und Kommentare auf Englisch.
- Barrierefreiheit: semantisches HTML, sichtbarer Fokus, Kontraste, Tastaturbedienung.

**Gelöste Stolperfallen, bitte nicht neu erfinden**

- **Server-Client in Seiten:** Seiten mit Nutzerdaten nutzen `lib/db/server.ts`. Der ruft `connection()` auf, sonst bricht das Prerendering ab. Daten lesende Teile in `<Suspense>` setzen. Statt Middleware gibt es `proxy.ts`.
- **Server → Client-Komponenten:** keine Funktionen oder Komponenten als Props übergeben (z. B. `Icon={Users}`), nur Daten oder fertige Elemente (`icon={<Users />}`). Lint und Build finden das nicht, die Seite stürzt erst beim Aufruf ab.
- **Realtime:** immer `subscribeToChanges()` aus `lib/db/realtime.ts`. Er setzt das Login-Token vor dem Abo, sonst sieht Realtime wegen RLS nichts.
- **Hydration:** Browser-Fähigkeiten (Mikrofon, Uhrzeit) über `useSyncExternalStore` mit Server-Snapshot `null` abfragen.
- **Nach Login:** nur `router.replace("/app")`, kein zusätzliches `router.refresh()`.
- **Formulare, die nach dem Absenden weiterleiten:** Next hält besuchte Seiten am Leben (Activity, `cacheComponents`). Vor `router.push` das Formular zurücksetzen (`form.reset()`, `setPending(false)`), sonst bleibt der Button beim nächsten Besuch deaktiviert. Siehe `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`.
- **Supabase CLI:** `supabase migration new` wartet auf Eingabe und hängt in nicht interaktiven Shells. Migrationsdatei von Hand anlegen.
- **Embeds mit zwei Fremdschlüsseln** auf dieselbe Tabelle (z. B. `invites` → `profiles`) brauchen den Namen: `profiles!invites_user_id_fkey(...)`.
