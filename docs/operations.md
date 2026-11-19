# Betrieb

Umgebungen, Datenbank ändern, Testkonten, KI-Pipeline, Releases. Wer an diesen Abläufen etwas ändert, passt diese Datei im selben PR an.

**Inhalt:** [Umgebungen](#umgebungen) · [Datenbank ändern](#datenbank-ändern) · [Testkonten](#testkonten) · [KI-Pipeline erweitern](#ki-pipeline-erweitern) · [Release](#release) · [Offene Aufgaben](#offene-aufgaben)

## Umgebungen

Siehe [Tech-Stack → Umgebungen](tech-stack.md#umgebungen).

## Datenbank ändern

1. Neue Datei `supabase/migrations/<JJJJMMTTHHMMSS>_<name>.sql` anlegen. Bestehende Migrationen nie ändern.
2. Auf Staging einspielen (`pnpm db:push` oder über den Supabase-Connector), danach Typen neu erzeugen.
3. Liegt die Version in Supabase anders als der Dateiname, die Datei auf die Version umbenennen.
4. RLS für jede neue Tabelle mitliefern und in `tests/integration/` testen.
5. Migration einspielen, **bevor** der Code auf `main` geht.

## Testkonten

Integrationstests legen Konten `cofuture.test+…@gmail.com` an und löschen sie nach jedem Testfile wieder (braucht `SUPABASE_SECRET_KEY`). Als Sicherheitsnetz löscht der `pg_cron`-Job `purge-test-users` stündlich alle Testkonten, die älter als eine Stunde sind.

## KI-Pipeline erweitern

- Prompts nie überschreiben: neue Version unter `prompts/v2/` anlegen. Jede Analyse speichert ihre `prompt_version`.
- Anbieter und Modelle nur in `lib/ai/llm.ts` bzw. `lib/stt/index.ts` ändern.
- Ausgaben laufen durch `lib/ai/schema.ts` und `finalizeMap()`, Tests in `tests/unit/analysis.test.ts`. `finalizeMap()` erkennt verkürzte IDs (`A1` → `A01`) und macht aus einem Widerspruch mit nur einer Quelle eine Einzelstimme.
- **Zeitlimits:** Jeder Anbieter bekommt ein Zeitlimit (Transkription 90 s, Fragen und Antworten zuordnen 15 s, Perspektivenkarte 45 s), danach übernimmt die Reserve. Ein Anbieter, der überlastet ist (429, 5xx) oder nicht antwortet, wird zwei Minuten übersprungen.
- **Fehlersuche:** Jeder Analyse-Job speichert in `analysis_jobs.result` die Rohantwort des Modells (`raw`), wie viele Antworten das Modell selbst zugeordnet hat (`coveredByModel`) und welche Anbieter vorher ausgefallen sind (`failures`).
- Die Transkription bekommt Frage und Kontext der Runde als Begriffshilfe, damit Fachbegriffe wie im Team geschrieben werden.
- An Gratis-Tarife gehen nur ausgedachte Testdaten.

## Release

Ablauf und Regeln stehen in [`versioning.md`](versioning.md#release).

## Offene Aufgaben

Die offenen Aufgaben im Betrieb stehen in der [README unter *Stand*](../README.md#offene-aufgaben-im-betrieb).
