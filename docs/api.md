# API

REST-Endpunkte als Next.js Route Handlers (ADR 010). Alle erwarten eine angemeldete Session (Cookie) und antworten mit JSON. Den Zugriff prüft zusätzlich die Datenbank per RLS.

## Fehlerformat

Jeder Fehler hat dieselbe Form:

```json
{ "error": { "code": "validation_failed", "message": "Bitte prüf deine Eingaben.", "fields": { "name": "Gib einen Teamnamen ein." } } }
```

`message` ist für Nutzer gedacht (Deutsch), `code` für den Code, `fields` nur bei Eingabefehlern.

| Code | Status | Bedeutung |
| --- | --- | --- |
| `unauthenticated` | 401 | Nicht angemeldet |
| `invalid_json`, `validation_failed` | 400 | Anfrage fehlerhaft |
| `forbidden` | 403 | Keine Berechtigung |
| `not_found`, `user_not_found` | 404 | Nicht vorhanden bzw. kein Konto zu dieser E-Mail |
| `invite_invalid` | 410 | Zugangslink abgelaufen oder schon benutzt |
| `already_member`, `email_exists`, `last_lead`, `last_owner`, `not_empty`, `not_eligible`, `self`, `round_closed`, `invalid_status` | 409 | Konflikt mit dem aktuellen Zustand |

## Organisationen und Zugang

Organisationen bündeln Personen und Teams (ADR 011). Eine Person kann in mehreren sein. Welche gerade gewählt ist, steht im Cookie `cofuture_org`; die Datenbank prüft immer die Mitgliedschaft.

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/organizations` | `{ "name": string }` | `201 { id, name }` | alle Angemeldeten, werden Owner; App wechselt dorthin |
| `POST` | `/api/organizations/current` | `{ "organizationId": uuid }` | `204` | Mitglieder der Organisation |
| `POST` | `/api/organizations/{orgId}/members` | `{ "displayName": string, "email": string, "role"?: string, "teamId"?: uuid }` | `201 { userId, link }`, `link` ist `null`, wenn es schon ein Konto gab | Owner |
| `POST` | `/api/organizations/{orgId}/members/{userId}/link` | `{ "resetPassword"?: boolean }` | `201 { link }` | Owner; macht ältere Links ungültig, `resetPassword` nur bei Konten der Organisation |
| `PATCH` | `/api/organizations/{orgId}/members/{userId}` | `{ "role": "owner" \| "member" \| "guest" }` | `200 { role }` | Owner; mindestens ein Owner bleibt |
| `DELETE` | `/api/organizations/{orgId}/members/{userId}` | – | `204` | Owner; entfernt auch aus allen Teams der Organisation |
| `DELETE` | `/api/organizations/{orgId}/members/{userId}/account` | – | `204` | Owner; nur Konten, die die Organisation angelegt hat und die in keiner anderen sind |
| `POST` | `/api/organizations/{orgId}/transfer` | `{ "userId": uuid }` | `200` | Owner; die Person wird Owner, du Mitglied |
| `DELETE` | `/api/organizations/{orgId}` | – | `204` | Owner, nur wenn sonst niemand drin ist; löscht Teams, Runden, Antworten |
| `POST` | `/api/invites/accept` | `{ "token": string, "password": string }` | `200 { email }` | ohne Login, mit gültigem Link |

Zugangslinks (`/zugang/{token}`) gelten 72 Stunden und nur einmal. Gespeichert wird nur der SHA-256-Hash des Tokens, die Tabelle `invites` ist für Clients gesperrt. Personenlisten liefert die Funktion `organization_people`; E-Mail-Adressen sehen nur Owner, Gäste sehen nur Personen aus ihren Teams.

## Teams

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/teams` | `{ "name": string }` | `201 { id, name }` | alle Angemeldeten, werden Leitung; Team gehört zur gewählten Organisation |
| `DELETE` | `/api/teams/{teamId}` | – | `204` | Leitung oder Owner, nur wenn sonst niemand im Team ist |
| `POST` | `/api/teams/{teamId}/transfer` | `{ "userId": uuid }` | `200` | Leitung oder Owner; neue Leitung darf kein Gast sein |
| `POST` | `/api/teams/{teamId}/members` | `{ "userId": uuid }` oder `{ "email": string }` | `201 { status: "added" }` | Leitung; Teams einer Organisation nehmen nur Personen daraus auf |
| `DELETE` | `/api/teams/{teamId}/members/{userId}` | – | `204` | Leitung (beliebige Mitglieder), alle (sich selbst) |

## Runden und Antworten

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/teams/{teamId}/rounds` | `{ "question": string, "context"?: string, "deadline": ISO-8601, "parentRoundId"?: uuid }` | `201 { id }` | Mitglieder des Teams, keine Gäste |
| `PATCH` | `/api/rounds/{roundId}` | `{ "status": "closed" }` | `200 { id, status }` | wer die Runde gestartet hat, Leitung |
| `PUT` | `/api/rounds/{roundId}/response` | `{ "body": string, "source"?: "text" \| "voice" }` | `201` bzw. `200 { pseudonym }` | Mitglieder, bis zur Frist |

Regeln in der Datenbank: Die Frage ist nach der ersten Antwort gesperrt, Fristen lassen sich nur in die Zukunft verschieben, Status nur `open → closed → decided`. `pg_cron` schließt Runden jede Minute nach Fristende. Andere Antworten sind erst nach dem Schließen sichtbar, über die View `round_responses` ohne Personenbezug.

## Sprachantworten

Ablauf (ADR 009): Der Browser lädt die Aufnahme **direkt** in den privaten Bucket `voice` unter `{userId}/{uuid}.{ext}` (nie durch eine Vercel-Funktion), dann:

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/rounds/{roundId}/voice` | `{ "path": string, "mime": string, "durationMs": number }` | `202 { jobId }` | Mitglieder, offene Runde, eigene Datei |
| `POST` | `/api/jobs/{jobId}/retry` | – | `202` | Transkription: wer sie angelegt hat; Analyse: Teammitglieder. Nach Fehler, max. 3 Versuche |
| `POST` | `/api/worker` | – (Header `Authorization: Bearer WORKER_SECRET`) | `200 { transcribe, analyze, sweptAudio }` | nur Server/pg_cron |

Der Auftrag startet direkt nach der Antwort (`after()`). Der Worker transkribiert (Groq, Reserve Gemini), schreibt den Text in `analysis_jobs.result` und löscht das Audio. Den Status liefert Supabase Realtime an die Person, die den Auftrag angelegt hat. Erst wenn sie das (korrigierte) Transkript speichert, wird es eine Antwort mit `source: "voice"`. Audio, das länger als 24 Stunden liegt, räumt `/api/worker` weg.

## Perspektivenkarte

Endet eine Runde mit mindestens einer Antwort (Button oder Frist per pg_cron), legt die Datenbank selbst einen Auftrag `kind = analyze` an (Trigger `enqueue_analysis`, genau einer pro Runde).

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/rounds/{roundId}/analysis` | – | `200 { status: "done" }` oder `202 { status, jobId }` | Teammitglieder |

Der Aufruf startet einen wartenden Auftrag (`after()`), `claim_jobs` sorgt dafür, dass er nur einmal läuft. Die Pipeline (`lib/ai/`) schickt nur Pseudonyme (`A01` …) und Antworttexte an das Modell (Gemini, Reserve Groq; `LLM_PROVIDER=groq` dreht die Reihenfolge), Prompt aus `prompts/v1/`. Danach prüft sie:

- Quell-IDs, die es nicht gibt, fliegen raus. Cluster und offene Fragen ohne gültige Quelle werden verworfen.
- Antworten, die das Modell nirgends einordnet, landen im Cluster „Nicht zugeordnet“ (`kind: "unassigned"`). So deckt die Karte immer 100 % ab. `covered_count` zeigt, wie viele das Modell selbst eingeordnet hat.

Das Ergebnis steht in `analyses` (eine Zeile pro Runde, mit `provider`, `model`, `prompt_version`, `duration_ms`), lesbar für alle im Team, per Realtime.

## Beschlüsse

Eine geschlossene Runde endet mit einem Beschluss, den ein Mensch schreibt. Die Perspektivenkarte wird nur referenziert.

| Methode | Pfad | Body | Antwort | Wer |
| --- | --- | --- | --- | --- |
| `POST` | `/api/rounds/{roundId}/decision` | `{ "body": string, "rationale": string, "clusterRefs"?: number[] }` | `201 { id }` | wer die Runde gestartet hat, Leitung; keine Gäste |
| `POST` | `/api/decisions/{decisionId}/read` | – | `204` | Teammitglieder (eigene Lesebestätigung) |
| `POST` | `/api/teams/{teamId}/rounds` mit `parentRoundId` | wie oben | `201 { id }` | Folgerunde oder Rückfrage zu einer geschlossenen Runde |

Fehler: `round_open` (409, Runde läuft noch), `already_decided` (409), `parent_open` (409, Ursprungsrunde läuft noch), `invalid_parent` (400, anderes Team).

Regeln in der Datenbank:

- `decide_round()` schreibt den Beschluss und setzt die Runde in einem Schritt auf `decided`. Ohne Beschluss lässt sich `decided` nicht setzen.
- Ein Beschluss pro Runde. Beschlüsse lassen sich nicht ändern oder löschen, damit sie nachvollziehbar bleiben.
- `cluster_refs` sind die Positionen der Cluster in `analyses.map.clusters`, auf die sich die Begründung stützt.
- Alle im Team sehen den Beschluss (`decisions`, Realtime). Lesebestätigungen sieht jede Person nur für sich; `decision_read_count()` liefert nur Zahlen („3 von 5 gelesen“), nie Namen.
- Folgerunden (`rounds.parent_round_id`) gehören zum selben Team, die Ursprungsrunde muss geschlossen oder entschieden sein.

Lesen (Organisationen, Teams, Mitglieder, Runden, Antworten) läuft direkt in Server Components über Supabase mit RLS, ohne eigenen Endpunkt.
