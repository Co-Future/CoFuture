# CLAUDE.md – CoFuture

Diese Datei gibt Claude Code (und allen im Team) den Kontext für dieses Repo. Sie liegt im Repo, damit **alle Teammitglieder mit denselben Regeln arbeiten**. Persönliche Einstellungen gehören in `CLAUDE.local.md` oder `.claude/settings.local.json`. Beide sind in `.gitignore`.

@AGENTS.md

## Projekt in einem Satz

CoFuture ist eine KI-Plattform, die Kommunikation und Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden automatisiert. Die KI fasst zusammen, strukturiert und belegt, **Menschen entscheiden**.

- **Leitfrage:** Wie kann KI die Kommunikation und den Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden automatisieren, ohne dass Menschen die Entscheidung abgeben?
- **Kontext:** Seminarprojekt „Zurück in die Digitale Zukunft“, Kategorie Arbeit.
- **Abgabe:** 05.02.2027. Lauffähige Plattform, kein reiner Klickprototyp.
- **Quelle der Wahrheit für Anforderungen und Planung:** Notion (Teamspace „CoFuture“, Seiten *Teamspace Startseite*, *Projektauftrag & Scope*, *Tech-Stack (End-to-End)*, Datenbank *Arbeitspakete & Aufgaben*). Wenn Code und Notion sich widersprechen, nachfragen statt raten.

## Kernfeature: AsyncMeet (zuerst bauen)

Kernstrecke: **Spracheingabe → Transkription → KI-Perspektivenkarte**

1. Frage oder Entscheidungsvorlage wird als Runde eingestellt (mit Frist).
2. Teilnehmende antworten per Sprache (max. 2 Min.) oder Text.
3. Audio wird transkribiert, Transkript ist korrigierbar, Audio wird danach gelöscht.
4. Nach Fristende analysiert die KI alle Antworten: Cluster, Konsens, Dissens, Einzelstimmen.
5. Jede Aussage der Karte verweist auf die Originalantwort(en).
6. Rückfragen und Folgerunden führen zum Beschluss, der mit Begründung an alle geht.

## Scope

- **MVP (Must):** Login, Teams, Dialogrunden, Antworten per Sprache/Text, Perspektivenkarte mit Quellen, Beschluss-Workflow, Wissensspeicher mit semantischer Suche, Rückkanal Führung ↔ Mitarbeitende.
- **Danach (MoSCoW):** Besprechungen intern/extern, E-Mail-Zusammenfassung, Kundenkontakt, Webseiten-Anfragen, Statusrunden, Stimmungsbild.
- **Out of Scope:** native Apps, Slack/Teams-Integration, SSO, Mandantenverwaltung, Zahlungen.
- **Erfolgskriterien:** E2E-Demo läuft, Analyse von 30 Antworten < 60 s, 100 % der Antworten in der Karte abgedeckt, DSGVO-konform.
- **Budget:** KI-API-Kosten < 50 € gesamt, kostenlose Hosting-Tarife.

## Gestaltungsprinzipien (nicht verhandelbar)

Diese Regeln gelten für jedes Feature. Wenn eine Umsetzung dagegen verstößt, darauf hinweisen.

- **Gleiche Sicht für alle.** Keine Auswertungen, die nur Führungskräfte sehen.
- **Inhalte bewerten, keine Personen.** Die KI prüft Fristen, Vollständigkeit, offene Aufgaben. Sie bewertet nie die Leistung einzelner Mitarbeitender.
- **Pseudonym als Standard.** Klarnamen nur nach Zustimmung.
- **Minderheiten sichtbar.** Einzelstimmen werden markiert, nicht herausgemittelt.
- **Belegbar.** Jede KI-Aussage hat mindestens eine Quell-ID. Ohne Quelle wird sie verworfen.
- **Mensch entscheidet.** Die KI bereitet vor, sie beschließt nichts.
- **Datensparsam.** An die KI gehen nur Pseudonyme und Antworttexte, keine E-Mail-Adressen. Alle Daten in der EU.

## Tech-Stack

| Bereich | Technologie |
| --- | --- |
| Sprache | TypeScript (strict) überall |
| Frontend | Next.js 16 (App Router, Server Components), React 19 |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react |
| Client-State / Formulare | TanStack Query, React Hook Form + Zod |
| Audio | MediaRecorder API (WebM/Opus, iOS: MP4/AAC) |
| Auslieferung | Web-App als PWA (kein Electron) |
| API | Next.js Route Handlers + Zod, einheitliches Fehlerformat |
| Datenbank | PostgreSQL bei Supabase (Frankfurt), Row Level Security, pgvector |
| Migrationen | Supabase CLI, SQL im Repo, generierte TS-Typen |
| Auth | Supabase Auth (Magic Link), `@supabase/ssr` |
| Storage | Supabase Storage, privater Bucket, Audio max. 24 h |
| Jobs | Tabelle `analysis_jobs` + Worker, `pg_cron` für Fristen |
| Live-Updates | Supabase Realtime, Fallback Polling |
| Speech-to-Text | Whisper-API (hinter Adapter in `lib/stt/`) |
| LLM | Claude oder OpenAI mit Structured Output (hinter Adapter in `lib/ai/`, Entscheidung im PoC) |
| E-Mail | Resend |
| Hosting | Vercel (Frankfurt) + Supabase EU |
| Tests | Vitest, Testing Library, Playwright + axe, k6, eigenes KI-Eval |
| Paketmanager | **pnpm** (über `corepack`) |

Offene Entscheidungen (bis Architektur-Review M3, 03.12.) werden als ADR in `docs/adr/` festgehalten.

## Repo-Struktur

```txt
app/                 # Next.js Seiten und Route Handlers (app/api/)
components/          # UI-Komponenten (shadcn/ui-Basis + eigene)
lib/
  db/                # Supabase-Clients, generierte Typen
  ai/                # LLM-Client, Provider-Adapter, Pipeline (extract → cluster → assess)
  stt/               # Speech-to-Text-Adapter
  validation/        # Zod-Schemas (geteilt mit API)
prompts/             # versionierte Prompts (v1, v2 …), nie still überschreiben
supabase/            # migrations/, functions/, seed.sql
eval/                # Golden Dataset + Eval-Skript
tests/               # unit/, integration/, e2e/, load/
docs/adr/            # Architekturentscheidungen
```

Nicht alle Ordner existieren schon. Neue Ordner nach diesem Schema anlegen.

## Befehle

```bash
corepack pnpm install     # Abhängigkeiten
corepack pnpm dev         # Dev-Server auf http://localhost:3000
corepack pnpm build       # Produktions-Build
corepack pnpm lint        # ESLint
```

Tipp: Mit `corepack enable` geht danach einfach `pnpm …`.

## Zusammenarbeit im Team über GitHub

Wir sind fünf Leute, die parallel (oft jeweils mit Claude Code) am selben Repo arbeiten. Damit das ohne Konflikte klappt:

### Branches

- **Nie direkt auf `main` pushen.** `main` ist immer lauffähig und wird nach Vercel deployt.
- Für jede Aufgabe ein eigener Branch von aktuellem `main`:
  `feat/<kurzbeschreibung>`, `fix/<…>`, `chore/<…>`, `docs/<…>`
  Beispiel: `feat/asyncmeet-audio-recorder`
- Wenn es in Notion ein Arbeitspaket gibt, die WBS-Nummer in den Branch oder PR-Titel schreiben (z. B. `feat/4.2-transkription`).
- Vor dem Start und vor dem PR: `git pull --rebase origin main`.

### Commits

- [Conventional Commits](https://www.conventionalcommits.org/de/): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- Kleine, in sich geschlossene Commits. Commit-Messages auf Deutsch oder Englisch, aber pro Commit einheitlich.

### Pull Requests

- Jede Änderung geht über einen PR mit **mindestens einem Review** einer anderen Person.
- PRs klein halten (Richtwert < 400 geänderte Zeilen). Lieber mehrere PRs.
- Im PR beschreiben: Was, warum, wie getestet, Screenshot bei UI-Änderungen, Link zur Notion-Aufgabe.
- Vor dem PR müssen `pnpm lint` und `pnpm build` lokal durchlaufen.
- Merge per **Squash**, Branch danach löschen.

### Konflikte vermeiden

- **Datenbank-Migrationen:** Nur eine Migration pro PR, Dateiname mit Zeitstempel (`supabase migration new <name>`). Vor dem Merge rebasen, damit die Reihenfolge stimmt. Bestehende Migrationen nie ändern, sondern eine neue anlegen.
- **Prompts:** Neue Version anlegen (`prompts/v2/…`), alte nicht überschreiben. Jede Analyse speichert ihre `prompt_version`.
- **Geteilte Dateien** (`app/layout.tsx`, `globals.css`, `lib/validation/`, Design-Tokens): Änderungen kurz im Team ankündigen.
- `pnpm-lock.yaml` nie von Hand bearbeiten. Bei Konflikten: `main` übernehmen und `pnpm install` neu laufen lassen.

### Secrets

- **Keine Schlüssel, Tokens oder echten Personendaten ins Repo.** Auch nicht in Tests oder Seed-Daten.
- Benötigte Variablen stehen ohne Werte in `.env.example`. Echte Werte in `.env.local` (ignoriert) und in Vercel.

### Zuständigkeiten (Hauptverantwortung, Reviews gern quer)

| Bereich | Verantwortlich |
| --- | --- |
| Projektleitung, Frontend, QA | Tom |
| KI-Pipeline & Evaluation | Constantin |
| Backend, Datenbank, DevOps | Luca |
| Requirements, Marketing | Lars |
| UX/UI & Design-System | Loran |

Die genaue Verteilung steht in Notion (*Arbeitspakete & Aufgaben*, Ansicht *Verteilung pro Person*).

## Hinweise für Claude Code

- **Next.js 16 weicht von älterem Wissen ab.** Vor neuem Next.js-Code die passende Doku in `node_modules/next/dist/docs/` lesen (siehe AGENTS.md).
- Erst den passenden Branch anlegen bzw. prüfen, dass man nicht auf `main` arbeitet.
- Nicht selbstständig auf `main` pushen, mergen oder Force-Pushen. Pushen nur auf den eigenen Feature-Branch.
- Bestehende Muster im Code übernehmen, statt neue Bibliotheken einzuführen. Neue Abhängigkeiten im PR begründen.
- KI-Aufrufe immer über die Adapter in `lib/ai/` bzw. `lib/stt/`, nie direkt aus Komponenten.
- Jede Ausgabe der KI per Zod/JSON-Schema validieren; Aussagen ohne Quell-ID verwerfen.
- UI-Texte auf Deutsch, Code (Variablen, Funktionen, Kommentare) auf Englisch.
- Barrierefreiheit mitdenken: semantisches HTML, Fokus sichtbar, Kontraste, Tastaturbedienung.
