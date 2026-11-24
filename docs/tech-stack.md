# Tech-Stack

Einzige Quelle für den Tech-Stack. `CLAUDE.md` bindet diese Datei ein, die README verlinkt nur hierher. Wer etwas am Stack ändert, passt diese Datei im selben PR an und trägt die Änderung unten ins [Änderungsprotokoll](#änderungsprotokoll) ein.

Nur Vercel und Supabase als Plattform. Neue Funktionen werden damit umgesetzt (siehe [Roadmap](roadmap.md)), neue Dienste nur mit ADR und Begründung im PR.

**Inhalt:** [Überblick](#überblick) · [Versionen](#versionen) · [Umgebungen](#umgebungen) · [Änderungsprotokoll](#änderungsprotokoll)

## Überblick

| Bereich | Technologie | ADR |
| --- | --- | --- |
| Sprache | TypeScript (strict) | – |
| Frontend | Next.js 16 (App Router, Server Components, `cacheComponents`), React 19, Tailwind CSS 4 mit eigenen Design-Tokens, lucide-react | [001](adr/001-web-framework-nextjs.md), [007](adr/007-auslieferung-web-app-pwa.md) |
| Formulare | eigene Felder in `components/ui/form.tsx`, Validierung mit Zod 4 (Schemas in `lib/validation/`, geteilt mit der API) | – |
| API | Route Handlers (REST), einheitliches Fehlerformat über `lib/api/respond.ts`, Aufrufe im Browser über `apiFetch` ([API-Referenz](api.md)) | [010](adr/010-api-route-handlers.md) |
| Datenbank | Supabase Postgres (Frankfurt), Row Level Security, `pg_cron`, Realtime, pgvector (HNSW) und Volltextsuche (`german`) für den Wissensspeicher | [002](adr/002-backend-datenbank-supabase.md), [006](adr/006-vektorsuche-pgvector.md), [013](adr/013-wissensspeicher.md) |
| Auth | Supabase Auth (E-Mail und Passwort), `@supabase/ssr`, einmalige Zugangslinks, Schutz über `proxy.ts` | [008](adr/008-login-email-passwort.md), [011](adr/011-zugang-organisationen-einladungen.md) |
| Organisationen | mehrere je Person, Auswahl per Cookie (`lib/organizations/current.ts`), Mitgliedschaft prüft immer die Datenbank | [011](adr/011-zugang-organisationen-einladungen.md) |
| Storage | Supabase Storage, privater Bucket `voice`, Upload direkt aus dem Browser, nie durch eine Vercel-Funktion (Limit 4,5 MB), Audio max. 24 h | [002](adr/002-backend-datenbank-supabase.md) |
| Jobs | Tabelle `analysis_jobs`, Start per `after()`, Worker `/api/worker` (max. 300 s je Lauf, in kleinen Schritten) | [009](adr/009-hintergrundjobs-worker-vercel.md) |
| Speech-to-Text | Whisper large-v3-turbo über Groq, Reserve Gemini (`lib/stt/`) | [004](adr/004-speech-to-text-groq-whisper.md) |
| Sprachmodell | Gemini 3.5 Flash mit Structured Output, Reserve Groq (`lib/ai/`) | [005](adr/005-sprachmodell.md) |
| Embeddings | Gemini `gemini-embedding-2`, 768 Dimensionen, ohne Reserve (`lib/ai/embed.ts`) | [013](adr/013-wissensspeicher.md) |
| E-Mail | vorerst keine, später Resend mit eigener Domain | – |
| Hosting | Vercel Hobby (Frankfurt), Supabase Free (Projekte `cofuture-staging` und `cofuture-prod`) | [003](adr/003-hosting-vercel.md) |
| Tests | Vitest (Unit, Integration gegen Staging), GitHub Actions | – |
| Paketmanager | pnpm über corepack, Node.js 22 (`.nvmrc`) | – |
| Versionierung | Semantic Versioning, [`CHANGELOG.md`](../CHANGELOG.md), Git-Tags `vX.Y.Z` ([Regeln](versioning.md)) | – |

## Versionen

Die genauen Versionen stehen in [`package.json`](../package.json). Hier nur, was beim Arbeiten zählt:

| Paket | Version | Hinweis |
| --- | --- | --- |
| `next`, `eslint-config-next` | 16.4.6 | APIs weichen vom Trainingsstand ab, Doku in `node_modules/next/dist/docs/` lesen |
| `react`, `react-dom` | 19.3.0 | |
| `tailwindcss`, `@tailwindcss/turbopack` | 4.3.3 | Tokens in `app/globals.css` |
| `@supabase/supabase-js`, `@supabase/ssr` | 2.x, 0.12.x | |
| `zod` | 4.x | |
| `vitest` | 5.x | |
| `supabase` (CLI) | 3.x | `supabase migration new` hängt in nicht interaktiven Shells |

## Umgebungen

| Umgebung | Code | Datenbank |
| --- | --- | --- |
| Produktion | `main`, automatisch über Vercel | derzeit `cofuture-staging` |
| Preview | jeder PR bekommt eine eigene Vercel-URL | `cofuture-staging` |
| Prod-Datenbank | – | `cofuture-prod` (noch nicht eingerichtet) |

Details zum Betrieb: [`operations.md`](operations.md).

## Änderungsprotokoll

Jede Änderung am Stack bekommt eine Zeile, neueste oben: neuer oder entfernter Dienst, neue Abhängigkeit, Major-Update, Wechsel von Anbieter oder Modell. Die CI prüft, dass neue oder entfernte Abhängigkeiten und Major-Updates in `package.json` hier auftauchen (`pnpm docs:check`).

| Datum | Version | Änderung | ADR / PR |
| --- | --- | --- | --- |
| 24.11.2026 | – | pgvector-Erweiterung aktiviert, Gemini `gemini-embedding-2` für den Wissensspeicher | [013](adr/013-wissensspeicher.md), dieser PR |
| 19.11.2026 | – | Semantic Versioning mit `CHANGELOG.md` und Git-Tags eingeführt, Doku-Prüfung in der CI | dieser PR |
| 18.11.2026 | 0.10.1 | Zeitlimit je KI-Anbieter, überlastete Anbieter werden zwei Minuten übersprungen | #37 |
| 17.11.2026 | 0.7.0 | `pg_cron`-Job `purge-test-users` löscht Testkonten | #25 |
| 17.11.2026 | 0.6.0 | Organisationen als Mandanten, einmalige Zugangslinks | [011](adr/011-zugang-organisationen-einladungen.md), #18 |
| 17.11.2026 | 0.4.0 | `pg_cron` schließt Runden nach Ablauf der Frist, Realtime für Runden | #8 |
| 16.11.2026 | 0.2.0 | Gemini 3.5 Flash als Sprachmodell, Groq als Reserve, Whisper über Groq (KI-PoC) | [004](adr/004-speech-to-text-groq-whisper.md), [005](adr/005-sprachmodell.md), #5 |
| 16.11.2026 | 0.2.0 | Supabase (Postgres, Auth, Storage, RLS) und Vitest | [002](adr/002-backend-datenbank-supabase.md), #4 |
| 12.11.2026 | 0.2.0 | Architekturentscheidungen 001 bis 010 | #3 |
| 10.11.2026 | 0.1.0 | Next.js 16, React 19, Tailwind CSS 4, TypeScript strict, pnpm | [001](adr/001-web-framework-nextjs.md), #1 |
