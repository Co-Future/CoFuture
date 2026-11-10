# CoFuture

**Zusammenarbeit neu denken. Mit KI.**

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
| Frontend | Next.js (App Router), Tailwind CSS, shadcn/ui, PWA |
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

## Status

Projektstart, November 2026. Abgabe: 05.02.2027.
