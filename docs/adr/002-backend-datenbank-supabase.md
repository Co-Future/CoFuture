# ADR 002: Backend und Datenbank Supabase (PostgreSQL)

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Optionen: PostgreSQL oder MongoDB; Supabase oder eigenes Node-Backend mit Postgres (Neon EU).

## Entscheidung

PostgreSQL bei Supabase, Region Frankfurt: Datenbank, Auth, Storage, Realtime aus einer Hand.

## Folgen

- Die Daten sind relational (Team → Runde → Antwort → Analyse → Beschluss). Flexible KI-Ergebnisse liegen als `jsonb` in `analyses`.
- Row Level Security auf allen Tabellen. Andere Teammitglieder lesen Antworten über eine View, die nur das Pseudonym zeigt.
- pgvector deckt den Wissensspeicher (E7) ab.
- Free-Tarif: 2 Projekte (Staging, Prod), 500 MB DB, 1 GB Storage. Free-Projekte pausieren nach 7 Tagen ohne Nutzung, deshalb ein Ping per GitHub Action.
