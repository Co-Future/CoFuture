# CoFuture

**Entscheidungen, die alle verstehen.** Zusammenarbeit neu denken. Mit KI.

[![CI](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml/badge.svg)](https://github.com/Co-Future/CoFuture/actions/workflows/ci.yml) ![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-1D4E89) ![Next.js 16](https://img.shields.io/badge/Next.js-16-1D4E89) ![Supabase](https://img.shields.io/badge/Supabase-Frankfurt-1D4E89)

CoFuture ist eine Plattform für Kommunikation und Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden. Die KI fasst zusammen, sortiert und belegt. Entscheiden tun die Menschen.

> **Leitfrage:** Wie kann KI die Kommunikation und den Wissensaustausch zwischen Führung, Mitarbeitenden und Kunden automatisieren, ohne dass Menschen die Entscheidung abgeben?

> **Diese README ist der Einstieg** für Ziel, Scope und Stand. Alles Technische steht in [`docs/`](docs/README.md), jede Information an genau einem Ort. Wer etwas fertigstellt oder den Plan ändert, passt README, Doku und [`CHANGELOG.md`](CHANGELOG.md) im selben PR an.

**Inhalt:** [Überblick](#überblick) · [Stand](#stand) · [Dokumentation](#dokumentation) · [Mitmachen](#mitmachen)

**Version:** siehe [`CHANGELOG.md`](CHANGELOG.md) und [Releases](https://github.com/Co-Future/CoFuture/tags) · [Semantic Versioning](docs/versioning.md)

---

## Überblick

### Problem

- Meetings kosten viel Zeit, sind schwer zu koordinieren, und oft reden nur wenige.
- Protokolle, Beschlüsse und Aufgaben gehen verloren.
- Kundenanfragen und E-Mails sind verstreut, es fehlt eine gemeinsame Historie.
- Wissen steckt in Köpfen, Postfächern und Chats statt an einem durchsuchbaren Ort.
- Stille Perspektiven gehen unter, Entscheidungen sind schwer nachvollziehbar.

### Kernfeature: AsyncMeet

Asynchroner **Austausch** statt Live-Meetings ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)):

1. Die Leitung spricht ihre Fragen in einem Rutsch ein. AsyncMeet zieht die einzelnen Fragen heraus und erkennt, an wen eine Frage nur gehen soll. Fragen lassen sich ändern, per Sprache ergänzen oder als Text hinzufügen. Eine Frist ist optional.
2. Alle Gefragten antworten per **Sprache oder Text**, wann und wo es passt. AsyncMeet ordnet eine eingesprochene Antwort den Fragen zu, jede Antwort steht als Karte unter ihrer Frage und lässt sich prüfen und ergänzen.
3. Sprachaufnahmen werden transkribiert, das Audio wird danach gelöscht.
4. Rückfragen an die Leitung stehen im Austausch selbst. Sie sehen nur die fragende Person und die Leitung. Eine Frage nur für bestimmte Personen sehen nur diese und die Leitung.
5. AsyncMeet erstellt **je Frage eine Perspektivenkarte**: Themen, Konsens, Dissens, Einzelstimmen, jede Aussage mit Quelle.
6. Folge-Austausche führen zum Beschluss, der mit Begründung an alle geht.

### Gestaltungsprinzipien

| Prinzip | Bedeutung |
| --- | --- |
| Gleiche Sicht für alle | Keine Auswertungen, die nur Führungskräfte sehen. Rollen ändern, was man tun darf, nie was man sieht. Ausnahme: Fragen nur für bestimmte Personen und Rückfragen sehen nur die Beteiligten ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)). |
| Inhalte statt Personen bewerten | Die KI prüft Fristen, Vollständigkeit und offene Aufgaben, nie die Leistung einzelner. |
| Pseudonym als Standard | Jede Person wählt ihren Anzeigenamen selbst, Klarnamen nur mit Zustimmung. Im Austausch erscheint dieser Name statt A01 (ADR 012), an die KI gehen nur Pseudonyme. |
| Minderheiten sichtbar | Einzelstimmen werden markiert, nicht herausgemittelt. |
| Belegbar | Jede KI-Aussage verweist auf mindestens eine Originalquelle, sonst wird sie verworfen. |
| Mensch entscheidet | Die KI bereitet vor, Menschen beschließen. |
| Datensparsam | An die KI gehen nur Pseudonyme und Texte. Alle Daten liegen in der EU. |

### Scope

| | Inhalt |
| --- | --- |
| **MVP** | Login, Organisationen und Teams, Dialogrunden, Antworten per Sprache und Text, Perspektivenkarte mit Quellen, Beschlüsse, Wissensspeicher, Rückkanal |
| **Danach** (MoSCoW) | Statusrunden, Besprechungen, E-Mail-Zusammenfassung, Kundenkontakt, Webseiten-Anfragen, Stimmungsbild |
| **Mandanten** | Organisationen bündeln Personen und Teams. Eine Person kann in mehreren sein, mit der Rolle Owner, Mitglied oder Gast ([ADR 011](docs/adr/011-zugang-organisationen-einladungen.md)). |
| **Nicht geplant** | Native Apps, Slack- oder Teams-Integration, SSO, Zahlungen |
| **Erfolgskriterien** | End-to-End-Demo läuft, Analyse von 30 Antworten unter 60 s, 100 % der Antworten in der Karte abgedeckt, DSGVO-konform |
| **Rahmen** | KI-Kosten unter 50 € gesamt, kostenlose Hosting-Tarife, Abgabe 05.02.2027 |

---

## Stand

Stand 18.11.2026, Version 0.11.0. AsyncMeet läuft von Anfang bis Ende: Organisation anlegen, neue Personen per Zugangslink, bestehende Konten per Einladung mit Bestätigung aufnehmen, Team anlegen, Runde starten, per Text oder Sprache antworten, Runde schließt, AsyncMeet erstellt die Perspektivenkarte mit Quellen, das Team hält den Beschluss mit Begründung fest.

| Schritt | Inhalt | Status |
| --- | --- | --- |
| 1 | Supabase-Fundament: Schema, Row Level Security, Pseudonyme, Tests | fertig |
| 2 | KI-Proof-of-Concept Groq vs. Gemini ([Bericht](eval/poc/REPORT.md)) | fertig |
| 3 | Registrieren, Anmelden, geschützter Bereich, Teams und Mitglieder | fertig |
| 3b | Organisationen, Personen anlegen, einmalige Zugangslinks ([ADR 011](docs/adr/011-zugang-organisationen-einladungen.md)) | fertig |
| 3c | App-Navigation: Seitenleiste mit Organisations-Menü, persönliches Dashboard, Team-Dashboards | fertig |
| 3d | Rollen Owner, Mitglied, Gast; Organisation und Team übergeben oder löschen (wenn leer); Konten der Organisation löschen, Passwort zurücksetzen | fertig |
| 3e | Einladungen mit Bestätigung: Wer schon ein Konto hat, nimmt die Einladung an oder lehnt ab; Owner ziehen offene Einladungen zurück. Zugangslinks nur noch für Konten der Organisation | fertig |
| 4 | Runden mit Frist, Textantworten, automatisches Schließen, Live-Updates | fertig |
| 5 | Sprachantworten: Aufnahme im Browser (bis 10 Min.), Transkription im Hintergrund, Audio wird gelöscht. Auch die Frage einer Runde lässt sich einsprechen, AsyncMeet schlägt Frage und Kontext vor | fertig |
| 6 | Perspektivenkarte: Analyse im Hintergrund, Quellenprüfung, Anzeige auf der Rundenseite | fertig |
| 7 | Beschlüsse: Beschluss mit Begründung, Folgerunden, Lesebestätigung, Oberfläche | fertig |
| 7c | Austausch mit mehreren Fragen: einsprechen und abgleichen, mehrere Zielpersonen je Frage, Prüfschritt mit eigenen Fragen, Antworten je Frage zusammengefasst, Rückfragen, Zusammenfassung je Frage und Antworten je Person, Frist optional, Beschlüsse vorerst ausgeblendet ([ADR 012](docs/adr/012-austausch-mehrere-fragen.md)) | fertig |
| 8 | Wissensspeicher ([Roadmap](docs/roadmap.md#8-wissensspeicher-mvp)) | offen |
| 9 | Rückkanal ([Roadmap](docs/roadmap.md#9-rückkanal-mvp)) | offen |

### Offene Aufgaben im Betrieb

- [ ] Prod-Datenbank `cofuture-prod` einrichten. Dort sind noch keine Migrationen, die App läuft gegen Staging.
- [ ] Vercel-Schutz für Preview-Links ausschalten, damit alle sie ohne Vercel-Login öffnen können.
- [x] Integrationstests für die Organisations-Funktionen (`tests/integration/organizations.test.ts`, `tests/integration/invitations.test.ts`).
- [ ] `pg_cron` ruft `/api/worker` als Sicherheitsnetz auf, sobald die Produktions-URL fest steht. Bis dahin startet die Analyse, sobald jemand die Rundenseite öffnet.
- [ ] `GEMINI_API_KEY` und `LLM_PROVIDER` in Vercel prüfen. Bis 17.11.2026 liefen alle Perspektivenkarten über die Reserve Groq. Warum Gemini ausfällt, steht jetzt im Analyse-Job unter `result.failures`.
- [ ] Playwright-E2E-Tests im Repo.
- [ ] Zuständigkeiten im Team festlegen und hier eintragen (wer verantwortet welchen Bereich).

---

## Dokumentation

| Thema | Link |
| --- | --- |
| Übersicht: wo steht was, was muss ich anpassen | [docs/README.md](docs/README.md) |
| **Tech-Stack** mit Änderungsprotokoll | [docs/tech-stack.md](docs/tech-stack.md) |
| **Architektur** mit Schaubildern (System, Ablauf, Jobs, Datenmodell) | [docs/architecture.md](docs/architecture.md) |
| **Geplante Funktionen** und was sie können sollen | [docs/roadmap.md](docs/roadmap.md) |
| API-Endpunkte | [docs/api.md](docs/api.md) |
| Architekturentscheidungen (ADR) | [docs/adr/](docs/adr/README.md) |
| Neu im Team, lokal einrichten | [docs/setup.md](docs/setup.md) |
| Betrieb: Datenbank, Testkonten, KI-Pipeline | [docs/operations.md](docs/operations.md) |
| Versionen und Releases | [docs/versioning.md](docs/versioning.md), [CHANGELOG.md](CHANGELOG.md) |
| Regeln für alle, auch Claude Code | [CLAUDE.md](CLAUDE.md) |

---

## Mitmachen

1. Branch von `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`, bei Roadmap-Schritten mit Nummer (`feat/7-beschluesse`)
2. Kleine Commits nach [Conventional Commits](https://www.conventionalcommits.org/de/)
3. Pull Request mit Vorlage. Freigabe durch Constantin oder Luca, CI muss grün sein.
4. Squash-Merge, Branch wird gelöscht. README, Doku und `CHANGELOG.md` im selben PR aktualisieren ([was muss ich anpassen?](docs/README.md#was-muss-ich-anpassen)).
5. Versionen und Releases nach [`docs/versioning.md`](docs/versioning.md).

Alle Regeln, auch für Claude Code: [`CLAUDE.md`](CLAUDE.md). Designsprache: [`CLAUDE.md#designsprache`](CLAUDE.md#designsprache), Tokens in [`app/globals.css`](app/globals.css).

Entstanden im Seminar „Zurück in die Digitale Zukunft“, Kategorie Arbeit.

## Lizenz

[MIT](LICENSE) © 2026 CoFuture-Team
