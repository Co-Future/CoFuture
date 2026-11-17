-- Round lifecycle: allowed status changes, frozen questions, automatic closing at the deadline.

-- Guards every update on rounds (RLS decides WHO may update, this decides WHAT may change).
create function public.guard_round_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not ((old.status = 'open' and new.status = 'closed') or (old.status = 'closed' and new.status = 'decided')) then
      raise exception 'invalid status change from % to %', old.status, new.status
        using errcode = 'P0001', hint = 'invalid_status';
    end if;
    if new.status = 'closed' then
      new.closed_at := now();
    end if;
  else
    new.closed_at := old.closed_at;
  end if;

  if (new.question is distinct from old.question or new.context is distinct from old.context)
     and exists (select 1 from public.responses where round_id = old.id) then
    raise exception 'question cannot change after the first answer' using errcode = 'P0001', hint = 'question_frozen';
  end if;

  if new.deadline is distinct from old.deadline and (old.status <> 'open' or new.deadline <= now()) then
    raise exception 'deadline can only move into the future while the round is open'
      using errcode = 'P0001', hint = 'invalid_deadline';
  end if;

  return new;
end;
$$;
create trigger guard_round_update
  before update on public.rounds
  for each row execute function public.guard_round_update();

-- How many answers a round has. Visible to all members, also while the round is open.
-- Reveals only the number, never who answered.
create function public.round_response_count(p_round_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::int
  from public.responses r
  join public.rounds ro on ro.id = r.round_id
  where r.round_id = p_round_id and public.is_team_member(ro.team_id);
$$;
revoke execute on function public.round_response_count(uuid) from public, anon;
grant execute on function public.round_response_count(uuid) to authenticated;

-- Closes every open round whose deadline has passed. Runs every minute via pg_cron.
create function public.close_expired_rounds()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  closed_count integer;
begin
  update public.rounds set status = 'closed' where status = 'open' and deadline <= now();
  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;
revoke execute on function public.close_expired_rounds() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('close-expired-rounds', '* * * * *', $$select public.close_expired_rounds()$$);
