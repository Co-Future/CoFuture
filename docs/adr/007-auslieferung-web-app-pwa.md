# ADR 007: Auslieferung als Web-App (PWA) statt Electron

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

In Notion stand zeitweise Electron (Desktop-App). Das Repo ist eine Next.js-Web-App.

## Entscheidung

Web-App, als PWA installierbar. Kein Electron.

## Folgen

- Kein MVP-Feature braucht Electron: Aufnahme, Login, Benachrichtigungen und Live-Updates laufen im Browser.
- Kein Installieren, läuft auch auf dem Handy, Updates sofort bei allen.
- Keine Builds pro Betriebssystem, keine Apple-Signierung (ca. 99 USD/Jahr), kein Auto-Update.
- Browser-Unterschiede (Safari/iOS-Audioformat) testen wir explizit.
