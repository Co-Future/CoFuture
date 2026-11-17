# CoFuture

**Entscheidungen, die alle verstehen.** Zusammenarbeit neu denken. Mit KI.

[![CI](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml/badge.svg)](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml) ![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-1D4E89)

CoFuture ist eine KI-gestützte Plattform, die Kommunikation und Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden automatisiert und für alle transparent macht. Die KI fasst zusammen, sortiert, protokolliert und verknüpft Wissen. Entscheiden tun die Menschen.

> **Leitfrage:** Wie kann KI die Kommunikation und den Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden automatisieren, ohne dass Menschen die Entscheidung abgeben?

Entstanden im Seminar „Zurück in die Digitale Zukunft“.

## Problem

- Meetings kosten viel Zeit, sind schwer zu koordinieren, und oft reden nur wenige.
- Protokolle, Beschlüsse und Aufgaben gehen verloren.
- Mailflut, verstreute Kundenanfragen, keine gemeinsame Kundenhistorie.
- Wissen steckt in Köpfen, Postfächern und Chats statt an einem durchsuchbaren Ort.
- Stille Perspektiven gehen unter, Entscheidungen sind schwer nachvollziehbar.

## Kernfeature: AsyncMeet

Asynchrone Abstimmungsrunden statt Live-Meetings:

1. Eine Frage oder Entscheidungsvorlage wird eingestellt.
2. Alle antworten per **Sprache oder Text**, wann und wo es passt.
3. Die Sprachantwort wird transkribiert.
4. Die KI erstellt eine **Perspektivenkarte**: Themen-Cluster, Konsens, Dissens, Einzelstimmen, jede Aussage mit Quelle.
5. Rückfragen und Folgerunden führen zum Beschluss, der mit Begründung an alle zurückgeht.

## Module

| Modul | Beschreibung |
| --- | --- |
| AsyncMeet | Asynchrone KI-Abstimmungsrunden mit Perspektivenkarte |
| Besprechungen | Transkript, Zusammenfassung, Beschlüsse, Aufgaben, Protokoll |
| E-Mails | Zusammenfassung, Priorisierung, Antwortentwürfe |
| Kundenkontakt | Anfragen aus Mail, Webseite und Chat mit Kundenhistorie |
| Webseite | Chat und Formular nehmen Anfragen strukturiert auf |
| Wissensspeicher | Semantische Suche über alle Ergebnisse, mit Quellenangabe |
| Rückkanal | Führung ↔ Mitarbeitende: Briefings, Statusrunden, Stimmungsbild |

## Gestaltungsprinzipien

- **Gleiche Sicht für alle**: keine Sonderauswertungen nur für Führungskräfte.
- **Inhalte statt Personen bewerten**: Die KI prüft Fristen und offene Aufgaben, bewertet aber keine Mitarbeitenden.
- **Pseudonym als Standard**, namentlich nur mit Zustimmung.
- **Minderheiten sichtbar**: Einzelstimmen werden markiert, nicht herausgemittelt.
- **Belegbar**: Jede KI-Aussage verweist auf die Originalquelle.
- **Mensch entscheidet**: Die KI bereitet vor, Team und Führung beschließen.
- **Datenschutz**: DSGVO-konform, Hosting in der EU.

## MVP-Scope

**Drin:** Login, Teams, Dialogrunden, Antworten per Sprache/Text, Perspektivenkarte mit Quellen, Beschluss-Workflow, Wissensspeicher, Rückkanal Führung ↔ Mitarbeitende.

**Danach (nach MoSCoW):** Besprechungen, E-Mail, Kundenkontakt, Webseiten-Anfragen, Statusrunden, Stimmungsbild.

**Nicht geplant:** native Apps, Slack/Teams-Integration, SSO, Zahlungsfunktionen.

**Mandanten:** Organisationen bündeln Personen und Teams (ADR 011). Sie starten schlank und dürfen bei Bedarf ausgebaut werden.

**Erfolgskriterien:** End-to-End-Demo läuft, Analyse von 30 Antworten in unter 60 s, 100 % der Antworten in der Karte abgedeckt, DSGVO-konforme Datenhaltung.

## Stand der Entwicklung (17.11.2026)

AsyncMeet läuft von Anfang bis Ende: Team anlegen, Runde starten, per Text oder Sprache antworten, Runde schließt (Button oder Frist), AsyncMeet erstellt die Perspektivenkarte mit Quellen.

| Schritt | Inhalt | Status |
| --- | --- | --- |
| 1 | Supabase-Fundament: Schema, Row Level Security, Pseudonyme, Tests | fertig |
| 2 | KI-Proof-of-Concept Groq vs. Gemini ([`eval/poc/REPORT.md`](eval/poc/REPORT.md)) | fertig |
| 3 | Registrieren, Anmelden, geschützter Bereich, Teams und Mitglieder | fertig |
| 4 | Runden mit Frist, Textantworten, automatisches Schließen (`pg_cron`), Live-Updates | fertig |
| 5 | Sprachantworten: Aufnahme im Browser, Upload, Transkription im Hintergrund, Audio wird gelöscht | fertig |
| 6 | Perspektivenkarte: Analyse im Hintergrund, Quellenprüfung, Anzeige auf der Rundenseite | fertig |
| 7 | Beschluss-Workflow (Rückfragen, Folgerunde, Beschluss mit Begründung) | als Nächstes |
| 8 | Wissensspeicher mit semantischer Suche (pgvector) | offen |
| 9 | Rückkanal Führung ↔ Mitarbeitende | offen |

Noch offen, aber klein: `pg_cron` ruft `/api/worker` als Sicherheitsnetz auf, sobald eine feste Produktions-URL steht. Seed-Skript zum Aufräumen der Testnutzer in Staging. Playwright-E2E-Tests im Repo (bisher nur lokal gelaufen).

## So funktioniert AsyncMeet technisch

```txt
Browser                         Next.js (Vercel)                    Supabase (Frankfurt)
───────                         ────────────────                    ────────────────────
Runde anlegen ───────────────▶  POST /api/teams/{id}/rounds ──────▶ rounds (RLS)
Text antworten ──────────────▶  PUT  /api/rounds/{id}/response ───▶ responses (Pseudonym A01 …)
Sprache aufnehmen
  └─ Upload direkt ──────────────────────────────────────────────▶ Storage-Bucket "voice" (privat)
  └─ Auftrag ────────────────▶  POST /api/rounds/{id}/voice ──────▶ analysis_jobs (transcribe)
                                after(): lib/jobs/transcribe.ts
                                  └─ lib/stt (Groq Whisper, Reserve Gemini)
                                  └─ Text in Job, Audio löschen
  ◀── Realtime: Transkript da, korrigieren, speichern ─────────────
Frist vorbei / Runde schließen                                     pg_cron oder PATCH → rounds.status = closed
                                                                    Trigger legt analysis_jobs (analyze) an
Rundenseite öffnen ──────────▶  POST /api/rounds/{id}/analysis
                                after(): lib/jobs/analyze.ts
                                  └─ lib/ai/perspective-map.ts (nur Pseudonyme + Texte)
                                  └─ lib/ai/llm.ts (Gemini, Reserve Groq)
                                  └─ Quell-IDs prüfen, Rest → "Nicht zugeordnet"
                                                                    analyses (eine Karte pro Runde)
  ◀── Realtime: Karte erscheint ohne Neuladen ─────────────────────
```

Wichtige Regeln, die im Code durchgesetzt werden:

- **Rechte liegen in der Datenbank.** Jede Tabelle hat Row Level Security. Wer was sehen und ändern darf, steht in den Migrationen, nicht im Frontend. Server-Code mit Admin-Rechten (`lib/db/admin.ts`) nur in Jobs und Worker.
- **Schwere Arbeit läuft als Job.** Transkription und Analyse laufen nie im Request, sondern über `analysis_jobs`. `claim_jobs()` sorgt dafür, dass jeder Auftrag nur einmal läuft (max. 3 Versuche).
- **Belegbar.** Jede Aussage der Karte braucht eine gültige Quell-ID, sonst wird sie verworfen. Antworten, die das Modell nicht einordnet, landen sichtbar unter „Nicht zugeordnet“. Abdeckung immer 100 %.
- **Datensparsam.** An die KI gehen nur Pseudonyme und Antworttexte. Audio wird nach der Transkription gelöscht, spätestens nach 24 Stunden.

Alle Endpunkte mit Rechten und Fehlercodes: [`docs/api.md`](docs/api.md). Begründungen: [`docs/adr/`](docs/adr/).

## Tech-Stack (umgesetzt)

| Bereich | Technologie |
| --- | --- |
| Sprache | TypeScript (strict) |
| Frontend | Next.js 16.4 (App Router, `cacheComponents`), React 19, Tailwind CSS 4 mit eigenen Design-Tokens, lucide-react |
| API | Next.js Route Handlers (REST), Zod 4, einheitliches Fehlerformat `{ error: { code, message, fields? } }` |
| Datenbank | Supabase Postgres (Frankfurt), Row Level Security, `pg_cron`, Realtime |
| Auth | Supabase Auth mit E-Mail + Passwort, `@supabase/ssr`, Schutz über `proxy.ts` |
| Storage | Supabase Storage, privater Bucket `voice`, Upload direkt aus dem Browser |
| Jobs | Tabelle `analysis_jobs`, Start per `after()`, Sicherheitsnetz `/api/worker` |
| Speech-to-Text | Whisper large-v3-turbo über Groq, Reserve Gemini (`lib/stt/`) |
| Sprachmodell | Gemini 3.5 Flash mit Structured Output, Reserve Groq `qwen/qwen3.8-27b` (`lib/ai/`) |
| Hosting | Vercel Hobby + Supabase Free (Projekt `cofuture-staging`) |
| Tests | Vitest (Unit + Integration gegen Staging), CI auf GitHub Actions |

## Repo-Struktur

```txt
app/
  (auth)/login, (auth)/registrieren   Anmeldung
  app/                                 geschützter Bereich: Teams, Runden
  api/                                 REST-Endpunkte (siehe docs/api.md)
components/
  auth/, teams/, rounds/               Bausteine der Seiten
  perspective-map.tsx                  Perspektivenkarte (auch Demo auf der Startseite)
  ui/form.tsx                          Felder, Buttons, Fehlermeldungen
lib/
  ai/          LLM-Adapter (llm.ts), Schema, Pipeline der Perspektivenkarte
  stt/         Speech-to-Text-Adapter
  jobs/        Hintergrundaufträge: transcribe.ts, analyze.ts
  db/          Supabase-Clients (Browser, Server, Admin), Realtime-Helfer, generierte Typen
  api/         Fehlerformat (Server) und apiFetch (Browser)
  auth/        aktuelle Person, Fehlertexte
  validation/  Zod-Schemas, geteilt zwischen Formular und API
prompts/v1/    versionierter Prompt der Perspektivenkarte
supabase/migrations/   alle Datenbankänderungen als SQL
eval/poc/      KI-Proof-of-Concept mit Testdaten und Bericht
tests/unit, tests/integration, tests/fixtures
docs/adr/, docs/api.md
```

## Lokal einrichten

Voraussetzungen: Node.js 22 (siehe `.nvmrc`), pnpm über corepack, Zugang zum Supabase-Projekt `cofuture-staging` (bei Luca anfragen).

```bash
git clone https://github.com/Co-Future/CoFuture.git
cd CoFuture
corepack pnpm install
cp .env.example .env.local
corepack pnpm dev            # http://localhost:3000
```

In `.env.local` eintragen (Werte bei Luca oder im Supabase-/Groq-/Gemini-Dashboard, nie ins Repo):

| Variable | Wofür | Pflicht |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Login, Daten lesen und schreiben | ja |
| `SUPABASE_SECRET_KEY` | Jobs und Worker (Admin-Rechte, nur Server) | für Sprache und Karte |
| `GROQ_API_KEY` | Transkription, Reserve-LLM | für Sprache |
| `GEMINI_API_KEY` | Perspektivenkarte | für die Karte (sonst nur Groq) |
| `LLM_PROVIDER` | `groq` stellt Groq vor Gemini, spart die Gemini-Quote beim Testen | nein |
| `WORKER_SECRET` | Schutz für `/api/worker`, mindestens 16 Zeichen | nein |

Die App startet auch ohne Werte, zeigt dann aber nur die Startseite.

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Dev-Server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Routen-Typen erzeugen und TypeScript prüfen |
| `pnpm test` | Unit-Tests, ohne Netz |
| `pnpm test:integration` | Tests gegen Staging und Groq (legt Wegwerf-Nutzer an, braucht `.env.local`) |
| `pnpm build` | Produktions-Build |
| `pnpm db:push` | neue Migrationen nach Staging spielen (braucht `supabase login` und DB-Passwort) |
| `pnpm db:types` | `lib/db/types.ts` aus der Datenbank neu erzeugen |

Die CI (`check`) führt lint, typecheck, test und build aus. Auf `main` geht nur ein PR mit grüner CI.

## Datenbank ändern

1. Neue Datei `supabase/migrations/<JJJJMMTTHHMMSS>_<name>.sql` anlegen. Bestehende Migrationen nie ändern.
2. Mit `pnpm db:push` nach Staging spielen, danach `pnpm db:types`.
3. RLS für jede neue Tabelle mitliefern und in `tests/integration/` testen (Wer darf lesen? Wer nicht?).
4. Eine Migration pro PR, vor dem Merge rebasen.

## KI-Pipeline erweitern

- **Prompt ändern:** `prompts/v1/` nie überschreiben. Neue Datei `prompts/v2/perspective-map.ts` anlegen und in `lib/ai/perspective-map.ts` umstellen. Jede Analyse speichert ihre `prompt_version` in `analyses`.
- **Anbieter oder Modell:** nur in `lib/ai/llm.ts` bzw. `lib/stt/index.ts`. Komponenten und Routen rufen nie direkt eine KI auf.
- **Ausgabe prüfen:** Das Modell liefert JSON nach `lib/ai/schema.ts`. `finalizeMap()` erzwingt die Gestaltungsprinzipien (Quellen, Abdeckung). Tests dazu in `tests/unit/analysis.test.ts`.
- **Qualität messen:** `eval/poc/` enthält Testdaten und das Vergleichsskript aus Schritt 2. Ein richtiges Golden Dataset (30 Antworten, Ziel < 60 s, 100 % Abdeckung) ist der nächste Ausbau.
- **Daten:** An Gratis-Tarife gehen nur ausgedachte Testdaten.

## Hinweise für Claude Code

Die verbindlichen Regeln stehen in [`CLAUDE.md`](CLAUDE.md). Diese Stolperfallen haben wir schon gelöst, bitte nicht neu erfinden:

- **Next.js 16:** Seiten mit Nutzerdaten rufen den Server-Client aus `lib/db/server.ts` auf. Der ruft `connection()` auf, sonst bricht das Prerendering ab. Statt Middleware gibt es `proxy.ts`. Vor neuem Next-Code die Doku in `node_modules/next/dist/docs/` lesen.
- **Realtime:** Immer `subscribeToChanges()` aus `lib/db/realtime.ts` benutzen. Der setzt das Login-Token vor dem Abo, sonst sieht Realtime wegen RLS nichts.
- **Hydration:** Browser-Fähigkeiten (Mikrofon, Uhrzeit) über `useSyncExternalStore` mit Server-Snapshot `null` abfragen, nicht direkt im Render.
- **Nach Login:** nur `router.replace("/app")`, kein zusätzliches `router.refresh()` (führt zu 404).
- **Supabase CLI:** `supabase migration new` wartet auf Eingabe und hängt in nicht interaktiven Shells. Migrationsdatei einfach von Hand anlegen.
- **Keine Schlüssel ins Repo**, auch nicht in Tests. Integrationstests lesen `.env.local`.

## Designsprache

Ruhig, klar, nachvollziehbar. Markenblau `#1D4E89`, Bernstein `#F2A33A` als Akzent, warme Papierflächen, hell und dunkel. Schriften: Manrope für Überschriften, Source Sans 3 für Text, JetBrains Mono für IDs. Die Tokens liegen in [`app/globals.css`](app/globals.css), die Regeln in [`CLAUDE.md`](CLAUDE.md#designsprache).

## Mitmachen

Wir arbeiten zu fünft parallel im Repo. Kurzfassung:

1. Branch von `main` anlegen: `feat/…`, `fix/…`, `docs/…`
2. Kleine Commits im Format [Conventional Commits](https://www.conventionalcommits.org/de/)
3. Pull Request mit Vorlage, Freigabe durch Constantin oder Luca, CI muss grün sein. Bauen PRs aufeinander auf, immer den ältesten zuerst mergen.
4. Squash-Merge, Branch löschen

Alle Regeln stehen in [`CLAUDE.md`](CLAUDE.md#zusammenarbeit-im-team-über-github).

## Status

MVP in Arbeit, AsyncMeet-Kernstrecke läuft (siehe [Stand der Entwicklung](#stand-der-entwicklung-17112026)). Abgabe: 05.02.2027.

## Lizenz

[MIT](LICENSE) © 2026 CoFuture-Team
