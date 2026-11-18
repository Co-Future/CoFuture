# CoFuture

**Entscheidungen, die alle verstehen.** Zusammenarbeit neu denken. Mit KI.

[![CI](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml/badge.svg)](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml) ![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-1D4E89) ![Next.js 16](https://img.shields.io/badge/Next.js-16-1D4E89) ![Supabase](https://img.shields.io/badge/Supabase-Frankfurt-1D4E89)

CoFuture ist eine Plattform für Kommunikation und Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden. Die KI fasst zusammen, sortiert und belegt. Entscheiden tun die Menschen.

> **Leitfrage:** Wie kann KI die Kommunikation und den Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden automatisieren, ohne dass Menschen die Entscheidung abgeben?

> **Diese README ist der zentrale Ausgangspunkt** für Ziel, Scope, Stand und Planung. Es gibt kein separates Planungstool. Wer etwas fertigstellt oder den Plan ändert, passt die README im selben PR an.

**Inhalt:** [Überblick](#überblick) · [Stand](#stand) · [Roadmap](#roadmap) · [Architektur](#architektur) · [Lokal einrichten](#lokal-einrichten) · [Betrieb](#betrieb) · [Mitmachen](#mitmachen)

---

## Überblick

### Problem

- Meetings kosten viel Zeit, sind schwer zu koordinieren, und oft reden nur wenige.
- Protokolle, Beschlüsse und Aufgaben gehen verloren.
- Kundenanfragen und E-Mails sind verstreut, es fehlt eine gemeinsame Historie.
- Wissen steckt in Köpfen, Postfächern und Chats statt an einem durchsuchbaren Ort.
- Stille Perspektiven gehen unter, Entscheidungen sind schwer nachvollziehbar.

### Kernfeature: AsyncMeet

Asynchroner **Austausch** statt Live-Meetings ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)):

1. Die Leitung spricht ihre Fragen in einem Rutsch ein. AsyncMeet zieht die einzelnen Fragen heraus und erkennt, an wen eine Frage nur gehen soll. Fragen lassen sich ändern, per Sprache ergänzen oder als Text hinzufügen. Eine Frist ist optional.
2. Alle Gefragten antworten per **Sprache oder Text**, wann und wo es passt. AsyncMeet ordnet eine eingesprochene Antwort den Fragen zu, jede Antwort steht als Karte unter ihrer Frage und lässt sich prüfen und ergänzen.
3. Sprachaufnahmen werden transkribiert, das Audio wird danach gelöscht.
4. Rückfragen an die Leitung stehen im Austausch selbst. Sie sehen nur die fragende Person und die Leitung. Eine Frage nur für bestimmte Personen sehen nur diese und die Leitung.
5. AsyncMeet erstellt **je Frage eine Perspektivenkarte**: Themen, Konsens, Dissens, Einzelstimmen, jede Aussage mit Quelle.
6. Folge-Austausche führen zum Beschluss, der mit Begründung an alle geht.

### Gestaltungsprinzipien

| Prinzip | Bedeutung |
| --- | --- |
| Gleiche Sicht für alle | Keine Auswertungen, die nur Führungskräfte sehen. Rollen ändern, was man tun darf, nie was man sieht. Ausnahme: Fragen nur für bestimmte Personen und Rückfragen sehen nur die Beteiligten ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)). |
| Inhalte statt Personen bewerten | Die KI prüft Fristen, Vollständigkeit und offene Aufgaben, nie die Leistung einzelner. |
| Pseudonym als Standard | Antworten erscheinen als A01, A02 …, Klarnamen nur mit Zustimmung. |
| Minderheiten sichtbar | Einzelstimmen werden markiert, nicht herausgemittelt. |
| Belegbar | Jede KI-Aussage verweist auf mindestens eine Originalquelle, sonst wird sie verworfen. |
| Mensch entscheidet | Die KI bereitet vor, Menschen beschließen. |
| Datensparsam | An die KI gehen nur Pseudonyme und Texte. Alle Daten liegen in der EU. |

### Scope

| | Inhalt |
| --- | --- |
| **MVP** | Login, Organisationen und Teams, Dialogrunden, Antworten per Sprache und Text, Perspektivenkarte mit Quellen, Beschlüsse, Wissensspeicher, Rückkanal |
| **Danach** (MoSCoW) | Statusrunden, Besprechungen, E-Mail-Zusammenfassung, Kundenkontakt, Webseiten-Anfragen, Stimmungsbild |
| **Mandanten** | Organisationen bündeln Personen und Teams. Eine Person kann in mehreren sein, mit der Rolle Owner, Mitglied oder Gast ([ADR 011](docs/adr/011-zugang-organisationen-einladungen.md)). |
| **Nicht geplant** | Native Apps, Slack- oder Teams-Integration, SSO, Zahlungen |
| **Erfolgskriterien** | End-to-End-Demo läuft, Analyse von 30 Antworten unter 60 s, 100 % der Antworten in der Karte abgedeckt, DSGVO-konform |
| **Rahmen** | KI-Kosten unter 50 € gesamt, kostenlose Hosting-Tarife, Abgabe 05.02.2027 |

---

## Stand

Stand 17.11.2026. AsyncMeet läuft von Anfang bis Ende: Organisation anlegen, neue Personen per Zugangslink, bestehende Konten per Einladung mit Bestätigung aufnehmen, Team anlegen, Runde starten, per Text oder Sprache antworten, Runde schließt, AsyncMeet erstellt die Perspektivenkarte mit Quellen, das Team hält den Beschluss mit Begründung fest.

| Schritt | Inhalt | Status |
| --- | --- | --- |
| 1 | Supabase-Fundament: Schema, Row Level Security, Pseudonyme, Tests | fertig |
| 2 | KI-Proof-of-Concept Groq vs. Gemini ([Bericht](eval/poc/REPORT.md)) | fertig |
| 3 | Registrieren, Anmelden, geschützter Bereich, Teams und Mitglieder | fertig |
| 3b | Organisationen, Personen anlegen, einmalige Zugangslinks ([ADR 011](docs/adr/011-zugang-organisationen-einladungen.md)) | fertig |
| 3c | App-Navigation: Seitenleiste mit Organisations-Menü, persönliches Dashboard, Team-Dashboards | fertig |
| 3d | Rollen Owner, Mitglied, Gast; Organisation und Team übergeben oder löschen (wenn leer); Konten der Organisation löschen, Passwort zurücksetzen | fertig |
| 3e | Einladungen mit Bestätigung: Wer schon ein Konto hat, nimmt die Einladung an oder lehnt ab; Owner ziehen offene Einladungen zurück. Zugangslinks nur noch für Konten der Organisation | fertig |
| 4 | Runden mit Frist, Textantworten, automatisches Schließen, Live-Updates | fertig |
| 5 | Sprachantworten: Aufnahme im Browser (bis 10 Min.), Transkription im Hintergrund, Audio wird gelöscht. Auch die Frage einer Runde lässt sich einsprechen, AsyncMeet schlägt Frage und Kontext vor | fertig |
| 6 | Perspektivenkarte: Analyse im Hintergrund, Quellenprüfung, Anzeige auf der Rundenseite | fertig |
| 7 | Beschlüsse: 7a Datenbank und API (Beschluss mit Begründung, Folgerunden, Lesebestätigung) fertig, 7b Oberfläche | in Arbeit |
| 7c | Austausch mit mehreren Fragen: einsprechen und abgleichen, Zielpersonen, Antworten je Frage, Rückfragen, Karte je Frage, Frist optional ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)). Offen: Gewichtung, Zusammenfassung, Beschlussvorschläge | in Arbeit |
| 8 | Wissensspeicher | offen |
| 9 | Rückkanal | offen |

**Offene Aufgaben im Betrieb**

- [ ] Prod-Datenbank `cofuture-prod` einrichten. Dort sind noch keine Migrationen, die App läuft gegen Staging.
- [ ] Vercel-Schutz für Preview-Links ausschalten, damit alle sie ohne Vercel-Login öffnen können.
- [x] Integrationstests für die Organisations-Funktionen (`tests/integration/organizations.test.ts`, `tests/integration/invitations.test.ts`).
- [ ] `pg_cron` ruft `/api/worker` als Sicherheitsnetz auf, sobald die Produktions-URL fest steht. Bis dahin startet die Analyse, sobald jemand die Rundenseite öffnet.
- [ ] `GEMINI_API_KEY` und `LLM_PROVIDER` in Vercel prüfen. Bis 17.11.2026 liefen alle Perspektivenkarten über die Reserve Groq. Warum Gemini ausfällt, steht jetzt im Analyse-Job unter `result.failures`.
- [ ] Playwright-E2E-Tests im Repo.
- [ ] Zuständigkeiten im Team festlegen und hier eintragen (wer verantwortet welchen Bereich).

---

## Roadmap

Alle geplanten Funktionen laufen ohne neue Dienste auf Vercel und Supabase, mit den vorhandenen KI-Adaptern in `lib/ai/` und `lib/stt/`. In der App stehen sie im Menü unter **Kommt noch** (Inhalt: `components/teams/planned-features.tsx`).

### 7c. AsyncMeet ausbauen: mehrere Fragen, Gewichtung, Beschlussvorschläge

Zielbild (Constantin, 17. und 18.11.2026), umgesetzt nach [ADR 012](docs/adr/012-austausch-mehrere-fragen.md).

- **Fragen einsprechen:** Die Leitung spricht mehrere Fragen ein, AsyncMeet zieht sie einzeln heraus. Neu einsprechen ersetzt alle Fragen. Ergänzen gleicht mit den bisherigen ab (unverändert, geändert, neu). Dazu kommen Fragen als Text. *Fertig.*
- **Zielpersonen:** „Die Frage geht nur an Tom“ wird erkannt, Personen lassen sich je Frage wählen. Rechts stehen alle Personen im Team. Gezielte Fragen sehen nur die Gefragten und wer den Austausch gestartet hat. *Fertig.* Gruppen ab etwa 30 Personen kommen später.
- **Alles auf einmal beantworten:** AsyncMeet ordnet eine eingesprochene Antwort den Fragen zu. Jede Antwort steht als Karte unter ihrer Frage und lässt sich ändern, per Sprache ergänzen oder komplett neu einsprechen. *Fertig.*
- **Rückfragen an die Leitung** im Austausch, sichtbar nur für die fragende Person und die Leitung. *Fertig.*
- **Auswertung je Frage:** Perspektivenkarte je Frage mit Quellen und Originalantworten *(fertig)*. Offen sind Gewichtung (wie viele Antworten stützen welche Sicht, Anteil am Team), kurze Zusammenfassung aller Antworten und die Originalantworten.
- **Übersicht Pseudonym × Frage:** Wer hat zu welcher Frage was gesagt, als Zitat. Keine Bewertung einzelner Personen (Gestaltungsprinzip *Inhalte statt Personen bewerten*).
- **Beschlussvorschläge:** AsyncMeet schlägt Beschlüsse mit Belegen vor, Menschen beschließen. Beschluss und Begründung lassen sich einsprechen. *Daran arbeitet Luca.*

**Umsetzung:** Tabellen `round_questions`, `round_question_targets`, `response_answers`, `round_clarifications`. Die KI-Schritte liegen in `lib/ai/exchange.ts` und laufen über den Transkriptions-Job. Die Gewichtung soll der Code aus den Quell-IDs zählen, nicht das LLM.

### 8. Wissensspeicher (MVP)

- Beschlüsse und Rundenergebnisse werden automatisch aufgenommen
- Suche nach Bedeutung und nach Stichwort in einem Feld
- Jeder Treffer mit Quelle und Link zur Runde oder zum Beschluss
- Frage stellen, Antwort mit Belegen erhalten
- Sichtbar ist nur, was man auch im Original sehen darf

**Umsetzung:** pgvector und Postgres-Volltextsuche (`german`), Embeddings als Job über `lib/ai/`, RLS auf jedem Abschnitt.

### 9. Rückkanal (MVP)

- Frage oder Hinweis an die Leitung, pseudonym oder mit Namen
- Antworten der Leitung sind für alle im Team sichtbar
- Ähnliche Fragen werden gebündelt, mit Quellen
- Briefings der Leitung mit Rückfragen
- Status offen oder beantwortet

**Umsetzung:** Tabellen `threads` und `messages` mit RLS, Pseudonym-Trigger wie bei Antworten, Realtime.

### Statusrunden

- Wiederkehrende Kurzrunde mit festen Fragen, zum Beispiel montags 9:00 Uhr
- Erinnerung im Dashboard unter „Wartet auf deine Antwort“
- Zusammenfassung zu Fortschritt, Blockern und Fristen
- Offene Aufgaben mit Frist

**Umsetzung:** `pg_cron` legt die Runden an, bestehende Runden- und Analyse-Jobs.

### Besprechungen

- Termin mit Agenda, die alle vorher ergänzen können
- Aufnahme im Browser oder als Datei hochladen, danach Transkript
- Zusammenfassung, Beschlüsse und Aufgaben mit Zeitmarke als Quelle
- Protokoll für alle Teilnehmenden in der App
- Externe Gäste per Zugangslink nur für diese Besprechung

**Umsetzung:** Upload direkt in Supabase Storage, Transkription in Abschnitten im Job-Worker, Realtime.

### E-Mail-Zusammenfassung

- E-Mail-Verlauf einfügen oder als `.eml`-Datei hochladen
- Zusammenfassung, offene Fragen, Fristen
- Antwortentwurf zum Bearbeiten
- Mit Kunde oder Team verknüpfen

**Umsetzung:** Einfügen oder Upload, Auswertung als Job. Kein Postfach-Abruf, eine Weiterleitungsadresse kommt erst mit Resend.

### Kundenkontakt

- Kundenkartei je Organisation
- Verlauf mit Anfragen, E-Mails und Besprechungen an einem Ort
- Anfrage einem Team zuweisen, Status verfolgen
- Zusammenfassung der Kundenhistorie mit Quellen
- Kundendaten auf Wunsch vollständig löschen

**Umsetzung:** Tabellen je Organisation mit RLS, Zusammenfassung als Job.

### Webseiten-Anfragen

- Öffentliches Anfrageformular je Organisation, als Link oder eingebettet
- Eingang mit Kategorie, Dringlichkeit und Kurzfassung
- Spamschutz über Honeypot und Ratenlimit
- Landet im Kundenkontakt und wird einem Team zugewiesen

**Umsetzung:** Öffentlicher Route Handler mit Zod, Tabelle ohne Client-Zugriff, Ratenlimit in Postgres.

### Stimmungsbild

- Kurze anonyme Abfrage mit Skala und optionalem Text
- Ergebnis erst ab 5 Antworten sichtbar
- Verlauf über die Zeit für das ganze Team
- Gleiche Sicht für alle, keine Auswertung einzelner Personen

**Umsetzung:** Tabelle mit RLS und View ohne Personenbezug (wie `round_responses`), `pg_cron` für Wiederholungen.

---

## Architektur

### Tech-Stack

| Bereich | Technologie |
| --- | --- |
| Sprache | TypeScript (strict) |
| Frontend | Next.js 16 (App Router, `cacheComponents`), React 19, Tailwind CSS 4 mit eigenen Design-Tokens, lucide-react |
| API | Next.js Route Handlers (REST), Zod 4, einheitliches Fehlerformat ([`docs/api.md`](docs/api.md)) |
| Datenbank | Supabase Postgres (Frankfurt), Row Level Security, `pg_cron`, Realtime |
| Auth | Supabase Auth (E-Mail und Passwort), `@supabase/ssr`, einmalige Zugangslinks, Schutz über `proxy.ts` |
| Storage | Supabase Storage, privater Bucket `voice`, Upload direkt aus dem Browser |
| Jobs | Tabelle `analysis_jobs`, Start per `after()`, Sicherheitsnetz `/api/worker` |
| Speech-to-Text | Whisper large-v3-turbo über Groq, Reserve Gemini (`lib/stt/`) |
| Sprachmodell | Gemini 3.5 Flash mit Structured Output, Reserve Groq (`lib/ai/`) |
| Hosting | Vercel Hobby (Frankfurt) und Supabase Free (EU) |
| Tests | Vitest (Unit und Integration gegen Staging), GitHub Actions |

Begründungen stehen in den [Architekturentscheidungen](docs/adr/).

### Ablauf eines Austauschs

```txt
Browser                         Next.js (Vercel)                    Supabase (Frankfurt)
───────                         ────────────────                    ────────────────────
Fragen einsprechen
  └─ Upload direkt, dann ────▶  POST /api/teams/{id}/voice ───────▶ analysis_jobs (transcribe, team_id)
                                Transkript → Fragen + Zielpersonen (lib/ai/exchange.ts)
  ◀── Realtime: Fragenkarten im Formular, prüfen und anpassen ─────
Austausch starten ───────────▶  POST /api/teams/{id}/rounds ──────▶ create_exchange(): rounds,
                                                                    round_questions, round_question_targets
Antworten speichern ─────────▶  PUT  /api/rounds/{id}/answers ────▶ save_answers(): responses (A01 …),
                                                                    response_answers (je Frage)
Rückfrage ───────────────────▶  POST /api/rounds/{id}/clarifications ▶ round_clarifications
Sprache aufnehmen
  └─ Upload direkt ──────────────────────────────────────────────▶ Storage-Bucket "voice" (privat)
  └─ Auftrag ────────────────▶  POST /api/rounds/{id}/voice ──────▶ analysis_jobs (transcribe)
                                after(): lib/jobs/transcribe.ts
                                  └─ lib/stt (Groq Whisper, Reserve Gemini)
                                  └─ Text in Job, Audio löschen
                                  └─ Antwort den Fragen zuordnen (lib/ai/exchange.ts)
  ◀── Realtime: Transkript da, wird angehängt und gespeichert ─────
Frist vorbei / Runde schließen                                     pg_cron oder PATCH → rounds.status = closed
                                                                    Trigger legt analysis_jobs (analyze) an
Rundenseite öffnen ──────────▶  POST /api/rounds/{id}/analysis (jede Minute erneut, solange sie wartet)
                                after(): lib/jobs/analyze.ts
                                  └─ lib/ai/perspective-map.ts (nur Pseudonyme und Texte)
                                  └─ Quell-IDs prüfen, Rest → "Nicht zugeordnet"
                                                                    analyses (eine Karte pro Runde)
  ◀── Realtime: Karte erscheint ohne Neuladen ─────────────────────
Rückfrage / Folgerunde ──────▶  POST /api/teams/{id}/rounds ──────▶ rounds.parent_round_id
Beschluss festhalten ────────▶  POST /api/rounds/{id}/decision ───▶ decide_round(): decisions,
                                                                    rounds.status = decided
Gelesen bestätigen ──────────▶  POST /api/decisions/{id}/read ────▶ decision_reads (nur eigene)
```

### Regeln im Code

- **Rechte liegen in der Datenbank.** Jede Tabelle hat Row Level Security. Server-Code mit Admin-Rechten (`lib/db/admin.ts`) nur in Jobs, Worker und Zugangslinks.
- **Schwere Arbeit läuft als Job.** Transkription und Analyse laufen nie im Request, sondern über `analysis_jobs`. `claim_jobs()` sorgt dafür, dass jeder Auftrag nur einmal läuft.
- **Mensch entscheidet.** Beschlüsse schreibt immer eine Person (Ersteller der Runde oder Teamleitung). „Entschieden“ gibt es nur zusammen mit einem Beschluss, Beschlüsse sind danach unveränderlich. Lesebestätigungen zählen nur, ohne Namen.
- **Belegbar.** Jede Aussage der Karte braucht eine gültige Quell-ID. Was das Modell nicht einordnet, landet sichtbar unter „Nicht zugeordnet“. Abdeckung immer 100 %.
- **Datensparsam.** An die KI gehen nur Pseudonyme und Antworttexte. Audio wird nach der Transkription gelöscht, spätestens nach 24 Stunden. Von Zugangslinks wird nur der Hash gespeichert.

### Repo-Struktur

```txt
app/
  (auth)/                login, registrieren (Organisation anlegen), zugang/[token]
  app/                   geschützter Bereich: Übersicht, Teams, Runden, Organisation, Kommt noch
  api/                   REST-Endpunkte (docs/api.md)
components/
  app-shell/             Seitenleiste, Organisations-Menü, Menüpunkte
  auth/, organizations/, teams/, rounds/, decisions/
  perspective-map.tsx    Perspektivenkarte
  ui/form.tsx            Felder, Buttons, Fehlermeldungen
lib/
  ai/, stt/              KI-Adapter (LLM, Speech-to-Text) und Pipeline
  jobs/                  Hintergrundaufträge: transcribe.ts, analyze.ts
  db/                    Supabase-Clients (Browser, Server, Admin), Realtime, generierte Typen
  organizations/, teams/ aktuelle Organisation, Zugangslinks, eigene Teams
  api/, auth/, validation/
prompts/v1/              versionierte Prompts
supabase/migrations/     alle Datenbankänderungen als SQL
eval/poc/                KI-Proof-of-Concept mit Testdaten und Bericht
tests/                   unit/, integration/, fixtures/
docs/                    adr/, api.md
```

---

## Neu im Team

**Nur anschauen und Feedback geben:** Die Live-Version läuft auf Vercel (Adresse bei Luca oder Constantin). Testkonten für das Team gibt es ebenfalls dort, nicht im Repo. Feedback als GitHub-Issue oder direkt an Luca oder Constantin.

**Mitentwickeln:** Diese Zugänge brauchst du, bevor `pnpm dev` alles kann:

| Was | Wie | Von wem |
| --- | --- | --- |
| GitHub | Mitglied der Organisation `Co-Future` | Luca oder Constantin laden ein |
| Supabase | Einladung in die Organisation, Rolle Developer (Projekt `cofuture-staging`) | Luca lädt ein |
| Supabase-Werte | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` und ein eigener `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys → Secret keys, einer pro Person) | Luca schickt sie privat |
| Groq-Key | selbst anlegen: [console.groq.com](https://console.groq.com) → API Keys → Create API Key (kostenlos) | du |
| Gemini-Key | selbst anlegen: [aistudio.google.com](https://aistudio.google.com) → Get API key → Create API key (kostenlos) | du |
| Vercel | nicht nötig. Jeder PR bekommt automatisch eine Vorschau-URL. | – |

Eigene KI-Keys, weil die Gratis-Kontingente pro Konto zählen und jeder Key einzeln gesperrt werden kann. Keys und Passwörter nie ins Repo, in Issues oder in Gruppenchats.

**Erster Start:**

1. Node.js 22 installieren ([nodejs.org](https://nodejs.org), LTS). Fehlt danach `corepack`, einmal `npm install -g corepack`.
2. Repo klonen und einrichten (siehe *Lokal einrichten*), Werte in `.env.local` eintragen. `WORKER_SECRET` ist ein beliebiger Zufallswert mit mindestens 16 Zeichen.
3. `corepack pnpm dev` starten, auf http://localhost:3000 eine Organisation anlegen (Registrieren), ein Team und eine Runde anlegen.
4. `corepack pnpm test` und `corepack pnpm test:integration` müssen grün sein. Dann passt die Einrichtung.
5. Mit Claude Code: im Repo-Ordner starten, es liest `CLAUDE.md` von selbst. Guter Einstieg: „Lies README.md und docs/api.md und erklär mir, wie eine Runde technisch abläuft.“
6. Für jede Aufgabe einen Branch, dann PR (siehe *Mitmachen*).

## Lokal einrichten

Voraussetzungen: Node.js 22 (`.nvmrc`), pnpm über corepack, Zugang zum Supabase-Projekt `cofuture-staging`.

```bash
git clone https://github.com/Co-Future/CoFuture.git
cd CoFuture
corepack pnpm install
cp .env.example .env.local
corepack pnpm dev            # http://localhost:3000
```

Werte für `.env.local` kommen aus den Dashboards von Supabase, Groq und Gemini, nie ins Repo:

| Variable | Wofür | Pflicht |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Login, Daten lesen und schreiben | ja |
| `SUPABASE_SECRET_KEY` | Jobs, Worker, Personen anlegen, Zugangslinks (nur Server) | für Sprache, Karte, Organisationen |
| `GROQ_API_KEY` | Transkription, Reserve-LLM | für Sprache |
| `GEMINI_API_KEY` | Perspektivenkarte | für die Karte (sonst nur Groq) |
| `LLM_PROVIDER` | `groq` stellt Groq vor Gemini | nein |
| `WORKER_SECRET` | Schutz für `/api/worker`, mindestens 16 Zeichen | nein |

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Dev-Server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Routen-Typen erzeugen und TypeScript prüfen |
| `pnpm test` | Unit-Tests, ohne Netz |
| `pnpm test:integration` | Tests gegen Staging (legt Wegwerf-Nutzer an und löscht sie danach wieder) |
| `pnpm build` | Produktions-Build |
| `pnpm db:push` | Migrationen nach Staging spielen (braucht `supabase login`) |
| `pnpm db:types` | `lib/db/types.ts` aus Staging neu erzeugen |

> **Repo im iCloud-Ordner?** iCloud lagert Dateien aus `node_modules` aus, dann hängen Lint und Build. Abhilfe steht in [`CLAUDE.md`](CLAUDE.md#repo-im-icloud-ordner). Besser: außerhalb von iCloud klonen.

---

## Betrieb

| Umgebung | Code | Datenbank |
| --- | --- | --- |
| Produktion | `main`, automatisch über Vercel | derzeit `cofuture-staging` |
| Preview | jeder PR bekommt eine eigene Vercel-URL | `cofuture-staging` |
| Prod-Datenbank | – | `cofuture-prod` (noch nicht eingerichtet) |

**Datenbank ändern**

1. Neue Datei `supabase/migrations/<JJJJMMTTHHMMSS>_<name>.sql` anlegen. Bestehende Migrationen nie ändern.
2. Auf Staging einspielen (`pnpm db:push` oder über den Supabase-Connector), danach Typen neu erzeugen.
3. Liegt die Version in Supabase anders als der Dateiname, die Datei auf die Version umbenennen.
4. RLS für jede neue Tabelle mitliefern und in `tests/integration/` testen.
5. Migration einspielen, **bevor** der Code auf `main` geht.

**Testkonten:** Integrationstests legen Konten `cofuture.test+…@gmail.com` an und löschen sie nach jedem Testfile wieder (braucht `SUPABASE_SECRET_KEY`). Als Sicherheitsnetz löscht der `pg_cron`-Job `purge-test-users` stündlich alle Testkonten, die älter als eine Stunde sind.

**KI-Pipeline erweitern**

- Prompts nie überschreiben: neue Version unter `prompts/v2/` anlegen. Jede Analyse speichert ihre `prompt_version`.
- Anbieter und Modelle nur in `lib/ai/llm.ts` bzw. `lib/stt/index.ts` ändern.
- Ausgaben laufen durch `lib/ai/schema.ts` und `finalizeMap()`, Tests in `tests/unit/analysis.test.ts`. `finalizeMap()` erkennt verkürzte IDs (`A1` → `A01`) und macht aus einem Widerspruch mit nur einer Quelle eine Einzelstimme.
- **Zeitlimits:** Jeder Anbieter bekommt ein Zeitlimit (Transkription 90 s, Fragen und Antworten zuordnen 15 s, Perspektivenkarte 45 s), danach übernimmt die Reserve. Ein Anbieter, der überlastet ist (429, 5xx) oder nicht antwortet, wird zwei Minuten übersprungen.
- **Fehlersuche:** Jeder Analyse-Job speichert in `analysis_jobs.result` die Rohantwort des Modells (`raw`), wie viele Antworten das Modell selbst zugeordnet hat (`coveredByModel`) und welche Anbieter vorher ausgefallen sind (`failures`).
- Die Transkription bekommt Frage und Kontext der Runde als Begriffshilfe, damit Fachbegriffe wie im Team geschrieben werden.
- An Gratis-Tarife gehen nur ausgedachte Testdaten.

---

## Mitmachen

1. Branch von `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`, bei Roadmap-Schritten mit Nummer (`feat/7-beschluesse`)
2. Kleine Commits nach [Conventional Commits](https://www.conventionalcommits.org/de/)
3. Pull Request mit Vorlage. Freigabe durch Constantin oder Luca, CI muss grün sein.
4. Squash-Merge, Branch wird gelöscht. README im selben PR aktualisieren, wenn sich Stand oder Plan ändern.

Alle Regeln, auch für Claude Code: [`CLAUDE.md`](CLAUDE.md). Designsprache: [`CLAUDE.md#designsprache`](CLAUDE.md#designsprache), Tokens in [`app/globals.css`](app/globals.css).

Entstanden im Seminar „Zurück in die Digitale Zukunft“, Kategorie Arbeit.

## Lizenz

[MIT](LICENSE) © 2026 CoFuture-Team
