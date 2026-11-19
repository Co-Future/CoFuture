# Versionierung

CoFuture folgt [Semantic Versioning](https://semver.org/lang/de/): Version `MAJOR.MINOR.PATCH`, zum Beispiel `0.10.1`. Alle Änderungen stehen im [`CHANGELOG.md`](../CHANGELOG.md) nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/). Jede Version bekommt einen Git-Tag `vX.Y.Z` auf `main`.

**Inhalt:** [Welche Stelle steigt](#welche-stelle-steigt) · [Changelog pflegen](#changelog-pflegen) · [Release](#release) · [Was die CI prüft](#was-die-ci-prüft)

## Welche Stelle steigt

| Stelle | Wann | Commit-Typ | Beispiel |
| --- | --- | --- | --- |
| **MAJOR** | Bruch für Nutzende oder Daten: alte Links, Daten oder Abläufe funktionieren nicht mehr. Bis zur Abgabe bleiben wir bei `0.x`. | `feat!`, `BREAKING CHANGE:` | `1.0.0` → `2.0.0` |
| **MINOR** | neue Funktion, neuer Roadmap-Schritt, neue Tabelle, neuer Endpunkt | `feat` | `0.10.1` → `0.11.0` |
| **PATCH** | Fehlerbehebung, kleine Verbesserung ohne neue Funktion | `fix`, `perf` | `0.10.0` → `0.10.1` |
| keine | nur Doku, Tests, CI, Aufräumen ohne Wirkung in der App | `docs`, `test`, `chore`, `refactor` | – |

**Meilensteine:**

| Version | Inhalt |
| --- | --- |
| `0.x` | Entwicklung bis zum MVP, Schnittstellen dürfen sich noch ändern |
| `1.0.0` | MVP vollständig (Schritte bis 9 aus der [Roadmap](roadmap.md)), Abgabe am 05.02.2027 |

## Changelog pflegen

- **Jeder PR**, der etwas in der App ändert (`app/`, `components/`, `lib/`, `supabase/`, `prompts/`, `proxy.ts`, `package.json`), trägt sich in `CHANGELOG.md` unter `## [Unreleased]` ein. Die CI prüft das.
- Rubriken: **Neu**, **Geändert**, **Behoben**, **Entfernt**, **Sicherheit**. Kurz, aus Sicht der Nutzenden, mit PR-Nummer, z. B. `- Rückfragen an die Leitung im Austausch (#36)`.
- Die PR-Nummer steht erst nach dem Öffnen fest. Dann nachtragen, oder ohne Nummer eintragen.
- Konflikt in `CHANGELOG.md`: beide Zeilen behalten.
- Reine Doku-, Test- oder CI-PRs brauchen keinen Eintrag. Berührt so ein PR trotzdem App-Dateien ohne Wirkung (nur Kommentare, Umbenennung), das Label `kein-changelog` setzen.
- **Version nicht in normalen PRs erhöhen.** Fünf Leute arbeiten parallel, sonst gibt es bei jeder Version Konflikte. Die Version steigt nur im Release-PR.

## Release

Ein Release fasst alles unter `[Unreleased]` zu einer Version zusammen. Sinnvoll nach jedem Roadmap-Schritt oder vor einer Vorführung. Starten darf es jede Person, freigeben Constantin oder Luca.

1. Branch `chore/release-X.Y.Z` von aktuellem `main`.
2. Nächste Version aus den Einträgen ableiten: gibt es **Neu**, steigt MINOR, sonst PATCH.
3. In `CHANGELOG.md` die Überschrift `## [X.Y.Z] – TT.MM.JJJJ` unter `[Unreleased]` einfügen und die Einträge dorthin verschieben. `[Unreleased]` bleibt leer stehen.
4. `"version"` in `package.json` auf `X.Y.Z` setzen.
5. Stack geändert? Version im [Änderungsprotokoll des Tech-Stacks](tech-stack.md#änderungsprotokoll) nachtragen. Architektur geändert? Ebenso im [Änderungsprotokoll der Architektur](architecture.md#änderungsprotokoll).
6. PR `chore(release): X.Y.Z`, nach Freigabe Squash-Merge.
7. Tag auf den Merge-Commit setzen und pushen:

   ```bash
   git switch main && git pull --rebase origin main
   git tag -a vX.Y.Z -m "CoFuture X.Y.Z"
   git push origin vX.Y.Z
   ```

8. Auf GitHub unter *Releases* aus dem Tag ein Release erstellen und den Abschnitt aus dem Changelog einfügen (optional).

## Was die CI prüft

`pnpm docs:check` (`scripts/check-docs.mjs`) läuft in jedem PR und auf `main`:

| Prüfung | Fehler, wenn |
| --- | --- |
| Version | `package.json` hat eine andere Version als die neueste Version im `CHANGELOG.md` |
| Changelog | ein PR ändert App-Code, aber nicht `CHANGELOG.md` (überspringen mit Label `kein-changelog`) |
| Tech-Stack | ein PR fügt eine Abhängigkeit hinzu, entfernt eine oder hebt sie auf eine neue Major-Version, ohne `docs/tech-stack.md` zu ändern |
| Datenmodell | eine Tabelle aus `supabase/migrations/` fehlt in `docs/architecture.md` |
| ADRs | eine ADR-Datei fehlt in der Übersicht `docs/adr/README.md` |
