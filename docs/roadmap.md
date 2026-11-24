# Roadmap

Geplante Funktionen und was sie können sollen. Der Fortschritt der fertigen Schritte steht in der [README unter *Stand*](../README.md#stand), Änderungen je Version im [`CHANGELOG.md`](../CHANGELOG.md).

**Pflege:** Wer eine Funktion plant, ändert oder fertigstellt, passt diese Datei im selben PR an: Status in der Übersicht, Einzelpunkte als *Fertig.* markieren, fertige Schritte in die README-Tabelle *Stand* übernehmen. In der App stehen die geplanten Funktionen unter **Kommt noch** (`components/teams/planned-features.tsx`), beide Listen müssen übereinstimmen.

Alle geplanten Funktionen laufen ohne neue Dienste auf Vercel und Supabase, mit den vorhandenen KI-Adaptern in `lib/ai/` und `lib/stt/`.

## Übersicht

| Schritt | Funktion | Kurz: was sie können soll | Scope | Status |
| --- | --- | --- | --- | --- |
| [7c](#7c-asyncmeet-ausbauen-mehrere-fragen-gewichtung-beschlussvorschläge) | AsyncMeet ausbauen | mehrere Fragen, Gewichtung der Sichten, Beschlussvorschläge mit Belegen | MVP | in Arbeit |
| [8](#8-wissensspeicher-mvp) | Wissensspeicher | Beschlüsse und Ergebnisse durchsuchen, Fragen mit Belegen beantworten | MVP | in Arbeit |
| [9](#9-rückkanal-mvp) | Rückkanal | Fragen und Hinweise an die Leitung, Antworten für alle sichtbar | MVP | offen |
| [–](#statusrunden) | Statusrunden | wiederkehrende Kurzrunden mit Zusammenfassung zu Fortschritt und Blockern | Danach | offen |
| [–](#besprechungen) | Besprechungen | Agenda, Aufnahme, Protokoll mit Beschlüssen und Zeitmarken | Danach | offen |
| [–](#e-mail-zusammenfassung) | E-Mail-Zusammenfassung | Verlauf einfügen, Zusammenfassung und Antwortentwurf | Danach | offen |
| [–](#kundenkontakt) | Kundenkontakt | Kundenkartei mit Verlauf und Zuweisung an Teams | Danach | offen |
| [–](#webseiten-anfragen) | Webseiten-Anfragen | öffentliches Formular, Eingang mit Kategorie und Kurzfassung | Danach | offen |
| [–](#stimmungsbild) | Stimmungsbild | anonyme Kurzabfrage, Ergebnis ab 5 Antworten | Danach | offen |

**Nicht geplant:** native Apps, Slack- oder Teams-Integration, SSO, Zahlungen.

## Funktionen im Detail

### 7c. AsyncMeet ausbauen: mehrere Fragen, Gewichtung, Beschlussvorschläge

Zielbild (Constantin, 17. und 18.11.2026), umgesetzt nach [ADR 012](adr/012-austausch-mehrere-fragen.md).

- **Fragen einsprechen:** Die Leitung spricht mehrere Fragen ein, AsyncMeet zieht sie einzeln heraus. Neu einsprechen ersetzt alle Fragen. Ergänzen gleicht mit den bisherigen ab (unverändert, geändert, neu). Dazu kommen Fragen als Text. *Fertig.*
- **Zielpersonen:** „Die Frage geht nur an Tom“ wird erkannt, Personen lassen sich je Frage wählen. Rechts stehen alle Personen im Team. Gezielte Fragen sehen nur die Gefragten und wer den Austausch gestartet hat. *Fertig.* Gruppen ab etwa 30 Personen kommen später.
- **Alles auf einmal beantworten:** AsyncMeet ordnet eine eingesprochene Antwort den Fragen zu. Jede Antwort steht als Karte unter ihrer Frage und lässt sich ändern, per Sprache ergänzen oder komplett neu einsprechen. *Fertig.*
- **Rückfragen an die Leitung** im Austausch, sichtbar nur für die fragende Person und die Leitung. *Fertig.*
- **Auswertung je Frage:** Perspektivenkarte je Frage mit Quellen und Originalantworten *(fertig)*. Offen sind Gewichtung (wie viele Antworten stützen welche Sicht, Anteil am Team), kurze Zusammenfassung aller Antworten und die Originalantworten.
- **Übersicht Pseudonym × Frage:** Wer hat zu welcher Frage was gesagt, als Zitat. Keine Bewertung einzelner Personen (Gestaltungsprinzip *Inhalte statt Personen bewerten*).
- **Beschlussvorschläge:** AsyncMeet schlägt Beschlüsse mit Belegen vor, Menschen beschließen. Beschluss und Begründung lassen sich einsprechen. *Daran arbeitet Luca.*

**Umsetzung:** Tabellen `round_questions`, `round_question_targets`, `response_answers`, `round_clarifications`. Die KI-Schritte liegen in `lib/ai/exchange.ts` und laufen über den Transkriptions-Job. Die Gewichtung soll der Code aus den Quell-IDs zählen, nicht das LLM.

### 8. Wissensspeicher (MVP)

Umgesetzt nach [ADR 013](adr/013-wissensspeicher.md): Inhalt sind Zusammenfassungen je Frage, Cluster und Beschlüsse (keine einzelnen Antworten), Suche über die ganze Organisation mit Team-Filter.

- Beschlüsse und Rundenergebnisse werden automatisch aufgenommen *(fertig, 8a)*
- Suche nach Bedeutung und nach Stichwort in einem Feld
- Jeder Treffer mit Quelle und Link zur Runde oder zum Beschluss
- Frage stellen, Antwort mit Belegen erhalten
- Sichtbar ist nur, was man auch im Original sehen darf

**Umsetzung:** pgvector und Postgres-Volltextsuche (`german`), Embeddings als Job über `lib/ai/embed.ts`, RLS auf jedem Eintrag *(8a fertig)*. Offen: 8b Hybridsuche und Seite „Wissen“, 8c Frage mit Belegen.

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
