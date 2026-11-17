-- Live updates for rounds (status changes, new rounds). RLS still applies to every subscriber,
-- so people only receive changes for rounds of their own teams.
alter publication supabase_realtime add table public.rounds;
