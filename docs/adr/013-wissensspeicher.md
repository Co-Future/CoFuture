# ADR 013: Wissensspeicher mit Gemini Embedding und Hybridsuche

**Status:** Vorgeschlagen und umgesetzt (8a), 24.11.2026 (Freigabe durch Constantin oder Luca). Ergänzt [ADR 006](006-vektorsuche-pgvector.md).

## Kontext

Der Wissensspeicher (Roadmap-Schritt 8) soll Ergebnisse aus dem Austausch auffindbar machen, nach Bedeutung und nach Stichwort. ADR 006 hat pgvector festgelegt, der Embedding-Anbieter war offen. Abgestimmt mit Luca am 24.11.2026:

- **Inhalt:** Zusammenfassung je Frage, Cluster der Perspektivenkarte und Beschlüsse. Keine einzelnen Antworten, sie bleiben als verlinkte Quelle erreichbar.
- **Reichweite:** Suche über die ganze Organisation, mit Filter nach Team. Das schafft Gleichheit zwischen Teams und Produkten.
- **Rechte:** Jeder Eintrag hat genau die Sichtbarkeit seines Originals, auch bei Fragen nur für bestimmte Personen (ADR 012).

## Entscheidung

- **Tabelle `knowledge_items`** mit Text, Volltext-Index (`german`) und Vektor (`vector(768)`, HNSW-Index, Kosinus). Ein Eintrag je Zusammenfassung, Cluster („Nicht zugeordnet“ ausgenommen) und Beschluss.
- **Aufnahme per Trigger in SQL** auf `analyses` und `decisions`. Eine neue Karte ersetzt die Einträge der Runde. Damit ist der Speicher vollständig, ohne dass ein KI-Aufruf gelingen muss.
- **Embeddings als Job** (`lib/jobs/embed.ts`): `claim_knowledge_items()` gibt jeden Eintrag nur einem Worker, höchstens 5 Versuche. Start nach jeder Analyse und jedem Beschluss, Sicherheitsnetz `/api/worker`. Bis der Vektor da ist, findet die Volltextsuche den Eintrag schon.
- **Anbieter: Gemini `gemini-embedding-2`** über den vorhandenen `GEMINI_API_KEY`, 768 Dimensionen (empfohlene Größe, passt unter die Grenze von 2.000 Dimensionen für pgvector-Indizes). Kein weiterer Dienst. Es gibt keinen Gratis-Ersatz: Fällt Gemini aus, bleibt der Vektor leer und wird später nachgeholt.
- **Sichtbarkeit in der Datenbank:** RLS über `can_see_knowledge()`, das dieselben Funktionen nutzt wie die Originale (`can_see_question`, `can_see_round`, `round_has_hidden_questions`). Schreiben nur über Trigger und Job.
- **Nächste Schritte:** 8b Hybridsuche als Datenbankfunktion (Volltext und Vektor zusammengeführt, läuft mit den Rechten der Person), 8c Frage mit Belegen über `lib/ai/` (Aussagen ohne Quell-ID werden verworfen).

### Nachtrag 8b (24.11.2026)

- **Aufgaben-Kennung im Text:** Gespeicherte Einträge gehen als `title: … | text: …`, Suchanfragen als `task: search result | query: …` an Gemini. In einem Test mit ausgedachten deutschen Beispielen lagen passende Treffer damit bei einer Ähnlichkeit von 0,66 bis 0,77, unpassende höchstens bei 0,63. Ohne Kennung lagen beide zwischen 0,52 und 0,64 und ließen sich nicht trennen.
- **Schwelle 0,65** für Treffer nach Bedeutung (`MIN_SIMILARITY` in `lib/ai/embed.ts`). Darunter zählt nur der Stichwort-Treffer.
- **Kennzeichen `EMBEDDING_MARKER`** an jedem Vektor (`gemini-embedding-2:768:prefix-v1`). Ändern sich Modell, Größe oder Textformat, rechnet der Job alle Einträge mit anderem Kennzeichen von selbst neu.
- **Suche:** `search_knowledge()` führt Volltext (`websearch_to_tsquery('german')`) und Vektorsuche per Reciprocal Rank Fusion (k = 60) zusammen und läuft mit den Rechten der Person. Fundstellen im Text markiert `ts_headline` mit `[[…]]`, die Oberfläche rendert das ohne HTML.
- Grenze der Stichwortsuche: Zusammengesetzte Wörter werden nicht zerlegt („Hotline“ findet „Kundenhotline“ nicht per Stichwort). Die Suche nach Bedeutung fängt das auf.

## Folgen

- Kosten: laut Google 0,15 $ je 1 Mio. Tokens, für unser Volumen vernachlässigbar. Im Gratis-Tarif reichen die Limits für die Entwicklung. Vor echten Nutzern gilt wie beim Sprachmodell: bezahlter Tarif.
- Datenschutz: An Gemini gehen nur Frage, Titel und Zusammenfassung, keine Namen oder E-Mail-Adressen.
- Ein Wechsel von Modell oder Dimension heißt: alle Vektoren neu berechnen (`embedding = null` setzen, der Job holt sie nach). Deshalb steht `embedding_model` an jedem Eintrag.
