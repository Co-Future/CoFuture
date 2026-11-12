# ADR 010: API als Route Handlers (REST)

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Next.js bietet Route Handlers (eigene URLs) und Server Actions (Funktionsaufruf aus Formularen).

## Entscheidung

Route Handlers als Standard, z. B. `POST /api/rounds`, `GET /api/rounds/{id}/analysis`. Validierung mit Zod, einheitliches Fehlerformat. Server Actions nur für kleine UI-Sachen.

## Folgen

- Dokumentierbare API-Spezifikation (Arbeitspaket Datenmodell & API).
- Testbar mit curl, Integrationstests und k6 (Erfolgskriterium 30 Antworten < 60 s).
- Frontend und Backend arbeiten parallel gegen einen festen Vertrag.
