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

**Nicht geplant:** native Apps, Slack/Teams-Integration, SSO, Mandantenverwaltung, Zahlungsfunktionen.

**Erfolgskriterien:** End-to-End-Demo läuft, Analyse von 30 Antworten in unter 60 s, 100 % der Antworten in der Karte abgedeckt, DSGVO-konforme Datenhaltung.

## Tech-Stack (geplant)

| Bereich | Technologie |
| --- | --- |
| Sprache | TypeScript |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, PWA |
| API | Next.js Route Handlers, Zod |
| Datenbank | PostgreSQL bei Supabase (Frankfurt), Row Level Security, pgvector |
| Auth & Storage | Supabase Auth (Magic Link), Supabase Storage |
| Hintergrundjobs | Job-Queue + Worker, `pg_cron` |
| KI | Whisper-API (Speech-to-Text), Claude oder OpenAI mit Structured Output |
| E-Mail | Resend |
| Hosting | Vercel + Supabase (EU) |
| Tests | Vitest, Playwright, eigenes KI-Eval-Skript |

## Geplante Repo-Struktur

```txt
cofuture/
├─ app/             # Next.js Seiten und API
├─ components/      # UI-Komponenten
├─ lib/             # db/, ai/, stt/, validation/
├─ prompts/         # versionierte Prompts
├─ supabase/        # Migrationen, Edge Functions, Seed
├─ eval/            # Golden Dataset + Eval-Skript
├─ tests/           # unit, integration, e2e, load
└─ .github/         # CI
```

## Schnellstart

Voraussetzungen: Node.js 22 (siehe `.nvmrc`), pnpm über corepack.

```bash
git clone https://github.com/Co-Future/CoFuture.git
cd CoFuture
corepack pnpm install
cp .env.example .env.local   # Werte eintragen, sobald Supabase und KI angebunden sind
corepack pnpm dev            # http://localhost:3000
```

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Dev-Server |
| `pnpm build` | Produktions-Build inkl. Typprüfung |
| `pnpm lint` | ESLint |

## Designsprache

Ruhig, klar, nachvollziehbar. Markenblau `#1D4E89`, Bernstein `#F2A33A` als Akzent, warme Papierflächen, hell und dunkel. Schriften: Manrope für Überschriften, Source Sans 3 für Text, JetBrains Mono für IDs. Die Tokens liegen in [`app/globals.css`](app/globals.css), die Regeln in [`CLAUDE.md`](CLAUDE.md#designsprache).

## Mitmachen

Wir arbeiten zu fünft parallel im Repo. Kurzfassung:

1. Branch von `main` anlegen: `feat/…`, `fix/…`, `docs/…`
2. Kleine Commits im Format [Conventional Commits](https://www.conventionalcommits.org/de/)
3. Pull Request mit Vorlage, mindestens ein Review, CI muss grün sein
4. Squash-Merge, Branch löschen

Alle Regeln stehen in [`CLAUDE.md`](CLAUDE.md#zusammenarbeit-im-team-über-github).

## Status

Projektstart, November 2026. Abgabe: 05.02.2027.

## Lizenz

[MIT](LICENSE) © 2026 CoFuture-Team
