# ADR 006: Vektorsuche mit pgvector

**Status:** Vorgeschlagen, 12.11.2026 (Freigabe durch Constantin oder Luca)

## Kontext

Der Wissensspeicher (E7) braucht semantische Suche. Optionen: pgvector in Supabase, separater Vektor-Store.

## Entscheidung

pgvector in Supabase.

## Folgen

- Kein weiterer Dienst, RLS gilt auch für die Suche.
- Embedding-Anbieter wird mit E7 festgelegt: Gemini `gemini-embedding-2`, siehe [ADR 013](013-wissensspeicher.md).
