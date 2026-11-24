# Architektur

Wie CoFuture aufgebaut ist und wie die Teile zusammenspielen. Die Diagramme sind Mermaid und werden auf GitHub als Schaubild angezeigt.

**Pflege:** Wer die Architektur ändert (neue Tabelle, neuer Dienst, neuer Job-Typ, neuer KI-Schritt, neuer Ablauf), passt die betroffenen Diagramme im selben PR an und ergänzt das [Änderungsprotokoll](#änderungsprotokoll). Die CI prüft, dass jede Tabelle aus `supabase/migrations/` im [Datenmodell](#datenmodell) vorkommt (`pnpm docs:check`).

**Inhalt:** [Systemüberblick](#systemüberblick) · [Ablauf eines Austauschs](#ablauf-eines-austauschs) · [Hintergrundjobs](#hintergrundjobs) · [Datenmodell](#datenmodell) · [Regeln im Code](#regeln-im-code) · [Repo-Struktur](#repo-struktur) · [Änderungsprotokoll](#änderungsprotokoll)

Verwandt: [Tech-Stack](tech-stack.md) · [API](api.md) · [ADRs](adr/README.md)

## Systemüberblick

```mermaid
flowchart LR
  subgraph Browser
    UI["Next.js-Seiten<br/>React 19, Tailwind"]
    REC["Sprachaufnahme"]
  end

  subgraph Vercel["Vercel (Frankfurt)"]
    PROXY["proxy.ts<br/>Session prüfen"]
    RSC["Server Components<br/>lib/db/server.ts"]
    API["Route Handlers<br/>app/api/*"]
    JOBS["Jobs per after()<br/>lib/jobs/*"]
    WORKER["/api/worker<br/>Sicherheitsnetz"]
  end

  subgraph Supabase["Supabase (Frankfurt)"]
    AUTH["Auth"]
    DB[("Postgres<br/>RLS, pg_cron, pgvector")]
    RT["Realtime"]
    ST[("Storage<br/>Bucket voice")]
  end

  subgraph KI["KI-Anbieter (nur Pseudonyme und Texte)"]
    GROQ["Groq<br/>Whisper, Reserve-LLM"]
    GEM["Gemini 3.5 Flash<br/>Reserve-STT, Embeddings"]
  end

  UI --> PROXY --> RSC --> DB
  UI -- "apiFetch, JSON" --> API --> DB
  REC -- "Upload direkt" --> ST
  API -- "Auftrag" --> JOBS
  WORKER --> JOBS
  JOBS -- "lib/stt" --> GROQ
  JOBS -- "lib/ai" --> GEM
  JOBS -- "lib/ai, Reserve" --> GROQ
  JOBS --> DB
  JOBS -- "Audio löschen" --> ST
  DB --> RT -- "Live-Updates" --> UI
  UI --> AUTH
  DB -. "pg_cron: Fristen, Aufräumen" .-> DB
```

## Ablauf eines Austauschs

Kernfeature AsyncMeet nach [ADR 012](adr/012-austausch-mehrere-fragen.md). Endpunkte im Detail in [`api.md`](api.md).

```mermaid
sequenceDiagram
  autonumber
  actor L as Leitung
  actor P as Gefragte Person
  participant N as Next.js (Vercel)
  participant J as Job (after)
  participant S as Supabase
  participant K as KI (lib/ai, lib/stt)

  L->>S: Fragen einsprechen, Upload in Bucket voice
  L->>N: POST /api/teams/{id}/voice
  N->>S: analysis_jobs (transcribe, team_id)
  N-)J: Transkription starten
  J->>K: Whisper, dann Fragen und Zielpersonen herausziehen
  J->>S: Ergebnis im Job, Audio löschen
  S--)L: Realtime: Fragenkarten prüfen und anpassen
  L->>N: POST /api/teams/{id}/rounds
  N->>S: create_exchange(): rounds, round_questions, round_question_targets

  P->>N: PUT /api/rounds/{id}/answers (Text)
  N->>S: save_answers(): responses (A01 …), response_answers
  P->>N: POST /api/rounds/{id}/voice (Sprache)
  N-)J: Transkription, Antwort den Fragen zuordnen
  S--)P: Realtime: Transkript da
  P->>N: POST /api/rounds/{id}/clarifications
  N->>S: round_clarifications (nur Person und Leitung)

  Note over S: Frist vorbei (pg_cron) oder Runde schließen
  S->>S: rounds.status = closed, Trigger legt analysis_jobs (analyze) an
  L->>N: Rundenseite öffnen, POST /api/rounds/{id}/analysis
  N-)J: lib/jobs/analyze.ts
  J->>K: Perspektivenkarte je Frage (nur Pseudonyme und Texte)
  J->>J: Quell-IDs prüfen, Rest unter "Nicht zugeordnet"
  J->>S: analyses
  S--)L: Realtime: Karte erscheint

  L->>N: POST /api/rounds/{id}/decision
  N->>S: decide_round(): decisions, rounds.status = decided
  P->>N: POST /api/decisions/{id}/read
  N->>S: decision_reads (nur eigene)
```

## Hintergrundjobs

Transkription und Analyse laufen nie im Request. `claim_jobs()` sorgt dafür, dass jeder Auftrag nur einmal läuft.

```mermaid
stateDiagram-v2
  [*] --> pending: Route Handler oder Trigger legt Job an
  pending --> running: after() oder /api/worker, claim_jobs()
  running --> done: Ergebnis in analysis_jobs.result
  running --> pending: Fehler, nächster Versuch (attempts + 1)
  running --> running: hängt länger als 5 Min., wird neu übernommen
  running --> failed: dritter Versuch gescheitert, Fehler in error
  done --> [*]
  failed --> [*]
```

| Job-Typ | Code | Was passiert |
| --- | --- | --- |
| `transcribe` | `lib/jobs/transcribe.ts`, danach `lib/jobs/structure.ts` | Audio → Text (`lib/stt`), dann Fragen herausziehen (Team-Job) oder Antwort den Fragen zuordnen (`lib/ai/exchange.ts`), Audio löschen |
| `analyze` | `lib/jobs/analyze.ts` | Perspektivenkarte je Frage (`lib/ai/perspective-map.ts`), Quellenprüfung mit `finalizeMap()` |
| Embeddings (kein Eintrag in `analysis_jobs`) | `lib/jobs/embed.ts` | Trigger legen Einträge in `knowledge_items` an, der Job holt über `claim_knowledge_items()` alle ohne Vektor und berechnet sie (`lib/ai/embed.ts`). Start nach Analyse und Beschluss, Sicherheitsnetz `/api/worker` |

**Zeitlimits je Anbieter:** Transkription 90 s, Fragen und Antworten zuordnen 15 s, Perspektivenkarte 45 s. Danach übernimmt die Reserve. Ein überlasteter Anbieter (429, 5xx, keine Antwort) wird zwei Minuten übersprungen.

## Datenmodell

Vereinfacht, nur Tabellen und Beziehungen. Jede Tabelle hat Row Level Security. Quelle: `supabase/migrations/`, Typen in `lib/db/types.ts`.

```mermaid
erDiagram
  profiles ||--o{ organization_members : "ist in"
  organizations ||--o{ organization_members : hat
  organizations ||--o{ organization_invitations : "lädt ein"
  organizations ||--o{ invites : "Zugangslinks"
  organizations ||--o{ teams : hat
  profiles ||--o{ team_members : "ist in"
  teams ||--o{ team_members : hat
  teams ||--o{ rounds : hat
  rounds ||--o{ rounds : "Folgerunde"
  rounds ||--o{ round_questions : hat
  round_questions ||--o{ round_question_targets : "geht an"
  rounds ||--o{ responses : hat
  responses ||--o{ response_answers : "je Frage"
  round_questions ||--o{ response_answers : beantwortet
  rounds ||--o{ round_clarifications : Rückfragen
  rounds ||--o{ analysis_jobs : Aufträge
  teams ||--o{ analysis_jobs : "Fragen einsprechen"
  rounds ||--o| analyses : Perspektivenkarte
  rounds ||--o| decisions : Beschluss
  decisions ||--o{ decision_reads : Lesebestätigung
  analyses ||--o{ knowledge_items : "Zusammenfassung, Cluster"
  decisions ||--o| knowledge_items : Beschluss
  round_questions ||--o{ knowledge_items : "Sichtbarkeit je Frage"
```

| Tabelle | Zweck |
| --- | --- |
| `profiles` | Konto mit Anzeigename, angelegt per Trigger aus Supabase Auth |
| `organizations`, `organization_members` | Mandanten und Mitgliedschaft mit Rolle Owner, Mitglied oder Gast |
| `organization_invitations` | Einladungen an bestehende Konten, mit Annehmen und Ablehnen |
| `invites` | einmalige Zugangslinks, nur der Hash wird gespeichert |
| `teams`, `team_members` | Teams einer Organisation und ihre Mitglieder |
| `rounds` | ein Austausch mit optionaler Frist und Status, `parent_round_id` für Folgerunden |
| `round_questions`, `round_question_targets` | Fragen eines Austauschs und an wen sie gehen |
| `responses`, `response_answers` | eine Antwort je Person (Pseudonym A01 …) und ihre Teile je Frage |
| `round_clarifications` | Rückfragen an die Leitung, sichtbar nur für Beteiligte |
| `analysis_jobs` | Hintergrundaufträge `transcribe` und `analyze` mit Status, Versuchen, Ergebnis und Fehler |
| `analyses` | Perspektivenkarte je Runde mit `prompt_version` |
| `decisions`, `decision_reads` | Beschluss mit Begründung und Lesebestätigungen ohne Namen |
| `knowledge_items` | Wissensspeicher: Zusammenfassungen, Cluster und Beschlüsse mit Volltext-Index und Vektor, Sichtbarkeit wie das Original ([ADR 013](adr/013-wissensspeicher.md)) |

## Regeln im Code

- **Rechte liegen in der Datenbank.** Jede Tabelle hat Row Level Security. Server-Code mit Admin-Rechten (`lib/db/admin.ts`) nur in Jobs, Worker und Zugangslinks.
- **Schwere Arbeit läuft als Job.** Transkription und Analyse laufen nie im Request, sondern über `analysis_jobs`.
- **KI nur über Adapter.** Anbieter und Modelle nur in `lib/ai/llm.ts` und `lib/stt/index.ts`. Prompts versioniert in `prompts/v1/`, nie überschreiben.
- **Mensch entscheidet.** Beschlüsse schreibt immer eine Person. „Entschieden“ gibt es nur zusammen mit einem Beschluss, Beschlüsse sind danach unveränderlich. Lesebestätigungen zählen nur, ohne Namen.
- **Belegbar.** Jede Aussage der Karte braucht eine gültige Quell-ID. Was das Modell nicht einordnet, landet sichtbar unter „Nicht zugeordnet“. Abdeckung immer 100 %.
- **Datensparsam.** An die KI gehen nur Pseudonyme und Antworttexte. Audio wird nach der Transkription gelöscht, spätestens nach 24 Stunden. Von Zugangslinks wird nur der Hash gespeichert.

## Repo-Struktur

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
  jobs/                  Hintergrundaufträge: transcribe.ts, analyze.ts, structure.ts
  db/                    Supabase-Clients (Browser, Server, Admin), Realtime, generierte Typen
  organizations/, teams/ aktuelle Organisation, Zugangslinks, Einladungen, eigene Teams
  rounds/                Entwürfe für Austausch und Antworten
  api/, auth/, validation/
prompts/v1/              versionierte Prompts
supabase/migrations/     alle Datenbankänderungen als SQL
scripts/                 Prüfskripte für die CI (check-docs.mjs)
eval/poc/                KI-Proof-of-Concept mit Testdaten und Bericht
tests/                   unit/, integration/, fixtures/
docs/                    Dokumentation (docs/README.md), adr/
```

## Änderungsprotokoll

Größere Änderungen an der Architektur, neueste oben. Kleinere stehen nur im [`CHANGELOG.md`](../CHANGELOG.md).

| Datum | Version | Änderung | ADR / PR |
| --- | --- | --- | --- |
| 24.11.2026 | – | Wissensspeicher (8a): `knowledge_items` mit pgvector und Volltext, Trigger auf `analyses` und `decisions`, Embedding-Job | [013](adr/013-wissensspeicher.md), dieser PR |
| 18.11.2026 | 0.10.0 | Austausch mit mehreren Fragen, Zielpersonen und Rückfragen: neue Tabellen `round_questions`, `round_question_targets`, `response_answers`, `round_clarifications` | [012](adr/012-austausch-mehrere-fragen.md), #36 |
| 18.11.2026 | 0.9.0 | Einladungen mit Bestätigung: `organization_invitations` | #32 |
| 17.11.2026 | 0.9.0 | Fragen einsprechen: Transkriptions-Job auch für Teams (`analysis_jobs.team_id`) | #33 |
| 17.11.2026 | 0.8.0 | Beschlüsse: `decisions`, `decision_reads`, `decide_round()` | #29 |
| 17.11.2026 | 0.6.0 | Organisationen als Mandanten: `organizations`, `organization_members`, `invites` | [011](adr/011-zugang-organisationen-einladungen.md), #18 |
| 17.11.2026 | 0.5.0 | Analyse-Job und Perspektivenkarte: `analyses` | #13 |
| 17.11.2026 | 0.4.0 | Runden, Antworten, Sprach-Jobs: `rounds`, `responses`, `analysis_jobs` | #8 |
| 16.11.2026 | 0.2.0 | Supabase-Fundament: `profiles`, `teams`, `team_members` mit RLS | #4 |
