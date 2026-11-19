# Dokumentation

Einstieg in die technische Dokumentation von CoFuture. Ziel, Scope und Stand stehen in der [README](../README.md), Regeln für alle (auch Claude Code) in [`CLAUDE.md`](../CLAUDE.md).

## Wo steht was

Jede Information hat genau einen Ort. Andere Dateien verlinken dorthin, statt sie zu wiederholen. So kann nichts auseinanderlaufen.

| Thema | Datei | Abschnitte |
| --- | --- | --- |
| Ziel, Scope, Stand, offene Aufgaben | [`README.md`](../README.md) | [Überblick](../README.md#überblick) · [Stand](../README.md#stand) · [Offene Aufgaben](../README.md#offene-aufgaben-im-betrieb) |
| Geplante Funktionen | [`roadmap.md`](roadmap.md) | [Übersicht](roadmap.md#übersicht) · [Funktionen im Detail](roadmap.md#funktionen-im-detail) |
| Tech-Stack | [`tech-stack.md`](tech-stack.md) | [Überblick](tech-stack.md#überblick) · [Versionen](tech-stack.md#versionen) · [Umgebungen](tech-stack.md#umgebungen) · [Änderungsprotokoll](tech-stack.md#änderungsprotokoll) |
| Architektur mit Schaubildern | [`architecture.md`](architecture.md) | [Systemüberblick](architecture.md#systemüberblick) · [Ablauf](architecture.md#ablauf-eines-austauschs) · [Jobs](architecture.md#hintergrundjobs) · [Datenmodell](architecture.md#datenmodell) · [Regeln](architecture.md#regeln-im-code) · [Repo-Struktur](architecture.md#repo-struktur) |
| API-Endpunkte | [`api.md`](api.md) | Fehlerformat, Endpunkte je Bereich |
| Entscheidungen | [`adr/`](adr/README.md) | eine Datei je Entscheidung |
| Einrichten | [`setup.md`](setup.md) | [Neu im Team](setup.md#neu-im-team) · [Lokal einrichten](setup.md#lokal-einrichten) · [Variablen](setup.md#umgebungsvariablen) · [Befehle](setup.md#befehle) |
| Betrieb | [`operations.md`](operations.md) | [Datenbank ändern](operations.md#datenbank-ändern) · [Testkonten](operations.md#testkonten) · [KI-Pipeline](operations.md#ki-pipeline-erweitern) |
| Versionen und Releases | [`versioning.md`](versioning.md), [`CHANGELOG.md`](../CHANGELOG.md) | [Regeln](versioning.md#welche-stelle-steigt) · [Release](versioning.md#release) · [CI-Prüfung](versioning.md#was-die-ci-prüft) |
| Designsprache | [`CLAUDE.md`](../CLAUDE.md#designsprache) | Tokens in `app/globals.css` |
| Regeln für Zusammenarbeit | [`CLAUDE.md`](../CLAUDE.md#zusammenarbeit) | Branches, PRs, Konflikte, Secrets |

## Was muss ich anpassen?

Im selben PR wie die Änderung, nie später. Die CI prüft die mit ✓ markierten Zeilen (`pnpm docs:check`).

| Du änderst … | dann passe an | CI |
| --- | --- | --- |
| etwas, das Nutzende merken (Funktion, Fehler, Verhalten) | `CHANGELOG.md` unter `[Unreleased]` | ✓ |
| einen Roadmap-Schritt (fertig, neu, anders geplant) | `docs/roadmap.md` und README *Stand* | |
| Abhängigkeit, Dienst, Anbieter, Modell, Plattform | `docs/tech-stack.md` mit Zeile im Änderungsprotokoll, bei größeren Wechseln eine ADR | ✓ |
| Tabelle, Job-Typ, KI-Schritt, Ablauf zwischen Browser, Vercel und Supabase | `docs/architecture.md`: Diagramm und Änderungsprotokoll | ✓ (Tabellen) |
| Endpunkt oder Fehlercode | `docs/api.md` | |
| Umgebungsvariable oder Befehl | `docs/setup.md` und `.env.example` | |
| Ablauf für Migrationen, Tests oder KI-Pipeline | `docs/operations.md` | |
| Regel für die Zusammenarbeit oder für Claude Code | `CLAUDE.md` | |
| eine neue Entscheidung | neue ADR in `docs/adr/` und Zeile in `docs/adr/README.md` | ✓ |

Widersprechen sich Code und Doku, gilt: nachfragen statt raten, dann die Doku im selben PR richtigstellen.
