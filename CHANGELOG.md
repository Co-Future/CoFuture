# Changelog

Alle Änderungen an CoFuture, neueste oben. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [Semantic Versioning](https://semver.org/lang/de/). Regeln und Release-Ablauf: [`docs/versioning.md`](docs/versioning.md).

Die Versionen bis 0.10.1 wurden am 19.11.2026 nachträglich aus der Git-Historie vergeben, jede entspricht dem Stand nach dem genannten PR.

## [Unreleased]

### Neu

- Gewichtung in der Zusammenfassung: je Punkt „5 von 8 Antworten · 63 %“ als Text, vom Code aus den Quellen gezählt statt von der KI, und je Frage „6 von 8 Gefragten haben geantwortet“
- Wissen (8c): „Frage beantworten“ auf der Seite „Wissen“. AsyncMeet antwortet nur aus dem Wissensspeicher, jede Aussage mit nummerierten Quellen, ohne passende Einträge keine Antwort. `POST /api/knowledge/ask` (ADR 013)
- Wissen (8b): neue Seite „Wissen“ in der Seitenleiste mit Suche nach Stichwort und nach Bedeutung über alle Teams der Organisation, Filter nach Team, markierte Fundstellen, Link zum Austausch. `GET /api/knowledge` (ADR 013)
- Beschlüsse wieder in der Oberfläche: im Austausch festhalten mit Begründung und Verweis auf die Zusammenfassung, Lesebestätigung, Archiv auf der Teamseite, „Neue Beschlüsse“ im Dashboard. Status „Entschieden“ statt „Abgeschlossen“
- Wissensspeicher, Teil 1 (8a): Zusammenfassungen, Cluster und Beschlüsse werden automatisch gespeichert, mit Volltext-Index und Vektor für die Suche nach Bedeutung. Sichtbar ist nur, was man auch im Original sieht (ADR 013)
- Semantic Versioning mit `CHANGELOG.md` und Git-Tags, Doku-Prüfung `pnpm docs:check` in der CI
- Dokumentation in `docs/` aufgeteilt: Tech-Stack, Architektur mit Diagrammen, Roadmap, Einrichten, Betrieb, Versionierung

## [0.11.0] – 18.11.2026

### Geändert

- Austausch überarbeitet: mehrere Personen je Frage, Prüfschritt mit eigenen Fragen, Zusammenfassung je Frage und Antworten je Person, neues Design (#38)

## [0.10.1] – 18.11.2026

### Behoben

- Zeitlimit je KI-Anbieter, überlastete Anbieter werden zwei Minuten übersprungen (#37)

## [0.10.0] – 18.11.2026

### Neu

- Austausch mit mehreren Fragen, Zielpersonen, Antworten je Frage und Rückfragen an die Leitung (#36, ADR 012)

## [0.9.0] – 18.11.2026

### Neu

- Einladungen mit Bestätigung für bestehende Konten, Owner ziehen offene Einladungen zurück (#32)
- Frage einsprechen, AsyncMeet schlägt Frage und Kontext vor (#33)

## [0.8.1] – 17.11.2026

### Behoben

- AsyncMeet-Ablauf zuverlässiger: Quell-IDs, Sprachantworten, Analyse (#31)

## [0.8.0] – 17.11.2026

### Neu

- Beschlüsse mit Begründung, Folgerunden und Lesebestätigung (#29)
- Beschlüsse in der Oberfläche (#30)

## [0.7.1] – 17.11.2026

### Behoben

- Formulare werden nach dem Absenden zurückgesetzt, Buttons bleiben nicht mehr deaktiviert (#28)

## [0.7.0] – 17.11.2026

### Neu

- Rollen Owner, Mitglied und Gast, Organisation und Team übergeben oder löschen (#23)
- Testkonten werden nach jedem Testlauf gelöscht, stündliches Aufräumen per `pg_cron` (#25)
- Integrationstests für Organisationen, Rollen und Zugangslinks (#27)

## [0.6.1] – 17.11.2026

### Behoben

- Icons werden fertig gerendert an die Menüpunkte übergeben (#21)

## [0.6.0] – 17.11.2026

### Neu

- Organisationen und einmalige Zugangslinks (#18, ADR 011)
- Seitenleiste, persönliches Dashboard und Organisationswechsel (#20)

## [0.5.0] – 17.11.2026

### Neu

- Perspektivenkarte auf der Rundenseite (#13)
- Teamseite als Dashboard mit Kennzahlen und geplanten Funktionen (#15)

## [0.4.0] – 17.11.2026

### Neu

- Teams anlegen, Mitglieder per E-Mail hinzufügen und entfernen (#7)
- Runden starten, Textantworten, automatisches Schließen nach der Frist (#8)

## [0.3.0] – 16.11.2026

### Neu

- Registrieren, Anmelden und geschützter Bereich (#6)

## [0.2.0] – 16.11.2026

### Neu

- Architekturentscheidungen ADR 001 bis 010 (#3)
- Supabase-Fundament mit Schema, Row Level Security, Pseudonymen und Tests (#4)
- KI-Proof-of-Concept Groq gegen Gemini (#5)

## [0.1.0] – 10.11.2026

### Neu

- Projekt-Setup mit Next.js 16, `CLAUDE.md` und Startseite (#1)
- CoFuture-Designsprache, Lizenz und Repo-Setup (#2)

[Unreleased]: https://github.com/Co-Future/CoFuture/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/Co-Future/CoFuture/compare/v0.10.1...v0.11.0
[0.10.1]: https://github.com/Co-Future/CoFuture/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/Co-Future/CoFuture/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Co-Future/CoFuture/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/Co-Future/CoFuture/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/Co-Future/CoFuture/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/Co-Future/CoFuture/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/Co-Future/CoFuture/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/Co-Future/CoFuture/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/Co-Future/CoFuture/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Co-Future/CoFuture/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Co-Future/CoFuture/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Co-Future/CoFuture/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Co-Future/CoFuture/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Co-Future/CoFuture/releases/tag/v0.1.0
