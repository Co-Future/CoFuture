# ADR 003: Hosting auf Vercel

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Die Next.js-App braucht Hosting mit Serverless-Funktionen in der EU. Optionen: Vercel, Render, Fly.io EU.

## Entscheidung

Vercel Hobby, Funktionsregion Frankfurt.

## Folgen

- Jeder Push auf `main` geht live, jeder PR bekommt eine Vorschau-URL.
- Grenzen: Request-Body max. 4,5 MB, Laufzeit max. 300 s pro Funktion. Siehe ADR 009 für den Umgang damit.
- Hobby ist ein Einzel-Account und nur für nicht-kommerzielle Projekte. Eine Person verbindet das Projekt.
- Kosten: 0 €.
