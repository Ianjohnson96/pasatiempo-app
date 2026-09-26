-- Caddie housekeeping, scheduled inside Postgres.
--
-- Vercel Hobby fires cron once a day. The waterfall widens a tier offer on the
-- minute scale, so once a day is not a schedule for it — it is a deferral.
-- pg_cron runs the same sweep every ten minutes from infrastructure the club
-- already owns: no third-party scheduler to sign up for, and nobody outside
-- holding the token that opens the endpoint.
--
-- The route is the single source of truth for what housekeeping means and in
-- what order it happens. Re-implementing that ordering in SQL would leave two
-- versions of it to keep in step, so this only calls it.
--
-- The daily Vercel cron in vercel.json stays as a backstop. Every sweep behind
-- the endpoint is idempotent and escalation is gated on elapsed time per loop,
-- so both firing changes nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The URL and bearer token come from Vault rather than sitting in the job
-- definition: cron.job is readable by anyone who can read the catalog, and that
-- token is the only thing standing between a stranger and the sweep.
create or replace function caddie.run_housekeeping()
  returns bigint
  language plpgsql
  security definer
  set search_path = caddie, pg_temp
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'caddie_cron_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'caddie_cron_secret';

  -- Fail loudly rather than return quietly. A sweep that does nothing every ten
  -- minutes is how escalation dies without anyone noticing until a caddie
  -- misses a loop; a raised exception lands in cron.job_run_details.
  if v_url is null or v_secret is null then
    raise exception
      'caddie housekeeping: missing vault secret caddie_cron_url or caddie_cron_secret';
  end if;

  -- Async by design: pg_net queues the request and a background worker performs
  -- it, so a slow sweep never holds a cron worker open. The reply lands in
  -- net._http_response, which caddie.housekeeping_runs reads back.
  --
  -- Sixty seconds because the sweep makes several round trips and then pushes
  -- to every phone that is due. The five-second default would cut it off
  -- mid-send and report a timeout for work that had actually happened.
  select net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

-- Nobody reaches this from the browser. It is cron's to call.
revoke all on function caddie.run_housekeeping() from public;

-- What happened on the last few sweeps, in plain sight.
--
-- pg_net keeps responses for a few hours and then clears them, so this is a
-- window on recent runs rather than a history. It shows every pg_net response
-- in the project; the caddie sweep is currently the only thing using pg_net.
create or replace view caddie.housekeeping_runs as
select
  r.id,
  r.created       as ran_at,
  r.status_code,
  r.timed_out,
  r.error_msg,
  r.content       as body
from net._http_response r
order by r.created desc;

-- Replace rather than duplicate, so re-running this file is safe.
select cron.unschedule('caddie-housekeeping')
where exists (select 1 from cron.job where jobname = 'caddie-housekeeping');

-- Every ten minutes: the tightest band the waterfall editor offers is ten
-- minutes, and a sweep cannot honour a window shorter than its own interval.
select cron.schedule(
  'caddie-housekeeping',
  '*/10 * * * *',
  $$select caddie.run_housekeeping()$$
);

-- ---------------------------------------------------------------------------
-- One manual step, run once by somebody who holds the secret. Kept here as a
-- record of what has to exist, not as something this file does — the value must
-- match CRON_SECRET in the Vercel project, and it should not travel through a
-- migration in source control.
--
--   select vault.create_secret(
--     'https://your-domain/api/cron/caddie', 'caddie_cron_url',   'Caddie sweep endpoint');
--   select vault.create_secret(
--     'the-CRON_SECRET-value',               'caddie_cron_secret','Caddie sweep bearer token');
--
-- To change one later:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'caddie_cron_secret'), 'new-value');
-- ---------------------------------------------------------------------------
