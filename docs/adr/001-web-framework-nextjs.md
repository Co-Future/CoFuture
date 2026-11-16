# ADR 001: Web-Framework Next.js

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Wir brauchen ein Framework für Oberfläche und Server-Code. Optionen: Next.js, SvelteKit, Vite + React.

## Entscheidung

Next.js 16 mit App Router, Server Components und TypeScript (strict).

## Folgen

- Oberfläche, API (Route Handlers) und Worker liegen in einem Projekt und einer Laufzeit (Node.js).
- Next.js 16 weicht von älterem Wissen ab: vor neuem Code die Doku in `node_modules/next/dist/docs/` lesen.
- Das Repo läuft bereits damit.
