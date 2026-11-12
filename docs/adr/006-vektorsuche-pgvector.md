# ADR 006: Vektorsuche mit pgvector

**Status:** Vorgeschlagen, 12.11.2026 (Zustimmung im Team bis M3, 03.12.2026)

## Kontext

Der Wissensspeicher (E7) braucht semantische Suche. Optionen: pgvector in Supabase, separater Vektor-Store.

## Entscheidung

pgvector in Supabase.

## Folgen

- Kein weiterer Dienst, RLS gilt auch für die Suche.
- Embedding-Anbieter wird mit E7 festgelegt.
