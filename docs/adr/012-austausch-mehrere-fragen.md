# ADR 012: Austausch mit mehreren Fragen, Zielpersonen und Rückfragen

**Status:** Vorgeschlagen und umgesetzt, 18.11.2026 (Freigabe durch Constantin oder Luca)

## Kontext

Bisher hatte eine Runde genau eine Frage, und jede Person gab genau eine Antwort. Constantin möchte (17. und 18.11.2026):

- Die Leitung spricht mehrere Fragen in einem Rutsch ein, AsyncMeet zieht die Fragen einzeln heraus.
- Fragen lassen sich neu einsprechen, per Sprache ergänzen oder als Text hinzufügen.
- Nennt die Leitung Personen („die Frage geht nur an Tom“), geht die Frage nur an sie.
- Die Mitarbeitenden antworten in einem Rutsch, AsyncMeet ordnet die Antwort den Fragen zu. Jede Antwort steht als Karte unter ihrer Frage und lässt sich ändern oder ergänzen.
- Rückfragen an die Leitung im Austausch selbst.
- Ein besserer Name als „Fragerunde“.

## Entscheidung

### Name: Austausch

In der Oberfläche heißt eine Runde jetzt **Austausch** („Austausch starten“). Ein Austausch kann eine Abfrage, ein asynchrones Meeting oder eine Abstimmung sein. In Code und Datenbank bleibt `rounds`, damit Migrationen, API und Beschlüsse stabil bleiben.

### Datenmodell (Migration `exchange_questions`)

| Tabelle | Inhalt |
| --- | --- |
| `round_questions` | Fragen eines Austauschs mit Reihenfolge. Die erste Frage an alle steht zusätzlich in `rounds.question` (Titel in Listen). |
| `round_question_targets` | An wen eine Frage geht. Keine Zeile heißt: an alle im Team. |
| `response_answers` | Antwort einer Person auf eine Frage. `responses` bleibt die Hülle mit Pseudonym und Gesamttext. |
| `round_clarifications` | Rückfragen an die Person, die den Austausch gestartet hat, mit ihrer Antwort. |

Bestehende Runden werden übernommen: Ihre Frage wird Frage 1, jede Antwort die Antwort darauf.

- Gestartet wird mit `create_exchange()` in einem Schritt (Austausch, Fragen, Zielpersonen). Gespeichert wird mit `save_answers()`. Beide prüfen Teammitgliedschaft, Status und Zielpersonen in der Datenbank.
- Die **Frist ist optional**. Ohne Frist bleibt der Austausch offen, bis ihn jemand schließt.
- Antworten anderer liest man nur über die View `round_answers` (nach dem Schließen, eigene sofort). Rückfragen liest man über `round_clarifications_public`, ohne Absender.

### KI-Schritte (über die vorhandenen Jobs)

- **Fragen einsprechen** (`prompts/v1/questions-extract.ts`): Transkript, bisherige Fragen und Teammitglieder (Kürzel P1, P2 … mit Anzeigename) gehen an das LLM. Zurück kommt die vollständige neue Fragenliste. Jede Frage ist markiert als unverändert, geändert oder neu, mit Bezug auf die bisherige Frage und den angesprochenen Personen.
  - **Neu einsprechen** ersetzt alle Fragen.
  - **Ergänzen** gleicht mit den bisherigen Fragen ab.
- **Antworten einsprechen** (`prompts/v1/answers-map.ts`): Transkript und die Fragen, die an die Person gehen (F1, F2 …). Zurück kommt der passende Ausschnitt je Frage.
  - Erfundene Frage-IDs werden verworfen.
  - Was keiner Frage zugeordnet ist, landet sichtbar unter „Nicht zugeordnet“.
  - Die Person prüft alle Karten vor dem Speichern.
- **Perspektivenkarte je Frage:** Der Analyse-Job baut für jede Frage eine eigene Karte. Gespeichert wird eine flache Liste von Themengruppen mit `question_id`, damit Beschlüsse weiter auf Gruppen verweisen können.

### Datenschutz

- Für die Zuordnung „Frage geht an Tom“ bekommt das LLM die Anzeigenamen des Teams, nie E-Mail-Adressen oder IDs. Die Namen stehen ohnehin im eingesprochenen Text.
- Anzeigenamen sind standardmäßig Pseudonyme.

### Sichtbarkeit: Ausnahme von „Gleiche Sicht für alle“ (Entscheidung Constantin, 18.11.2026)

| Was | Wer sieht es |
| --- | --- |
| Frage an alle, ihre Antworten und ihr Teil der Perspektivenkarte | alle im Team |
| Frage nur für bestimmte Personen, ihre Antworten und ihr Teil der Karte | diese Personen und wer den Austausch gestartet hat |
| Austausch, dessen Fragen alle gezielt sind | nur diese Personen und wer ihn gestartet hat |
| Rückfrage und Antwort | wer gefragt hat und wer den Austausch gestartet hat (beantwortet auch nur diese Person) |

Die Datenbank setzt das durch, nicht die Oberfläche:
- `can_see_question()` und `can_see_round()` stecken in den Policies von `rounds`, `round_questions`, `decisions` und `analysis_jobs` sowie in den Views.
- Wer nicht alle Fragen sieht, liest die Karte über `round_analysis()`. Darin sind Gruppen verborgener Fragen `null`, damit die Indizes der Beschlüsse stimmen.
- Der Titel in Listen ist die erste Frage an alle, damit gezielte Fragen dort nicht auftauchen.

**Abwägung:**
- Das Prinzip „Gleiche Sicht für alle“ soll verhindern, dass Führungskräfte Auswertungen sehen, die anderen verborgen bleiben.
- Hier bekommt die Person, die den Austausch gestartet hat, die Antworten auf gezielte Fragen. Das sind Einzelgespräche im Austausch, keine Auswertung über das Team.
- Es gibt weiterhin keine Anzeige, wer schon geantwortet hat. Personen werden nicht bewertet.

### Überarbeitung (Entscheidung Constantin, 18.11.2026)

- **Mehrere Personen je Frage:** „Die Frage geht an Test 1 und Test 2“ ergibt beide als Zielpersonen. Gesprochene Namen („Test eins“) werden auch ohne genaue Schreibweise zugeordnet (Prompt `v2/questions-extract`, `nameKey()`).
- **Prüfschritt vor dem Start:** Alle Fragen werden noch einmal gezeigt. Die startende Person wählt dort, welche Fragen sie selbst beantwortet (`round_questions.asks_starter`). Fragen an alle gehen sonst an alle außer ihr.
- **Antworten werden zusammengefasst:** Eine eingesprochene Antwort fasst AsyncMeet je Frage knapp zusammen, mit allen wichtigen Informationen und ohne Füllwörter (Prompt `v2/answers-map`). Die Person prüft und ändert die Zusammenfassung, bevor sie gespeichert wird. Die Antwort steht grün direkt unter der Frage.
- **Zusammenfassung je Frage:** Nach dem Schließen gibt es zu jeder Frage einen Querschnitt aller Antworten in 2 bis 3 Sätzen. Dazu kommen die wichtigsten Punkte mit der Zahl der Personen und ihren Namen (Prompt `v2/perspective-map`, Feld `overviews`). Jede Aussage hat Quellen.
- **Antworten je Person:** Unter jeder Person stehen ihre Antworten auf alle Fragen. Die startende Person sieht dort auch deren Rückfragen.
- **Namen statt A01:** Antworten und Rückfragen zeigen den Anzeigenamen, den jede Person selbst festlegt. Das ist eine Ausnahme von „Pseudonym als Standard“. Pseudonyme bleiben interne Quell-IDs, und nur sie gehen an das Sprachmodell.
- **Beschlüsse ausgeblendet:** Ein Austausch ist eher Frage und Rückkopplung als Abstimmung. Beschlüsse sind in der Oberfläche vorerst ausgeblendet. Tabellen, API und Lucas Code bleiben, damit sie später wieder eingebaut werden können.

## Folgen

- Neue Endpunkte und Seiten siehe `docs/api.md`.
- Gruppen ab etwa 30 Personen (Auswahl über Gruppen statt Einzelpersonen) kommen später.
- Beschlussvorschläge und Beschlüsse per Sprache bleiben bei Luca (Schritt 7).
