-- Integration tests create throwaway accounts (cofuture.test+<run>-<name>@gmail.com).
-- They delete their own accounts after each run; this job is the safety net for runs
-- that crash or run without the secret key. Real accounts never match the prefix.

-- Deletes test accounts, optionally only one run, optionally only older ones.
-- Teams in which only test accounts remain go first (a team always needs a lead).
create function public.purge_test_users(p_run text default null, p_older_than interval default interval '0')
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  pattern text := 'cofuture.test+' || coalesce(p_run || '-', '') || '%';
  removed integer;
begin
  create temp table purge_ids on commit drop as
    select id from auth.users
    where email like pattern and created_at < now() - p_older_than;

  delete from public.teams t
  where exists (select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id in (select id from purge_ids))
    and not exists (
      select 1 from public.team_members tm where tm.team_id = t.id and tm.user_id not in (select id from purge_ids)
    );

  delete from auth.users where id in (select id from purge_ids);
  get diagnostics removed = row_count;
  drop table purge_ids;
  return removed;
end;
$$;
revoke execute on function public.purge_test_users(text, interval) from public, anon, authenticated;
grant execute on function public.purge_test_users(text, interval) to service_role;

-- Safety net: every hour, test accounts older than one hour go.
select cron.schedule('purge-test-users', '17 * * * *', $$select public.purge_test_users(null, interval '1 hour')$$);
