-- ===========================================================================
-- Web push subscriptions for the caddie portal.
--
-- This is the point of the app. Caddies are on call, not in a yard: when a
-- member rings wanting a caddie on Saturday, the shop should press one button
-- and every active caddie's phone should buzz — instead of texting each of
-- them in turn, which is the job this is meant to replace.
--
-- Web push rather than SMS: free, instant, and it needs no carrier
-- registration, so there is no A2P 10DLC queue standing between the club and a
-- working system. The cost is that iPhones only allow it once the caddie has
-- added the portal to their home screen.
--
-- The endpoint and keys here are issued by the caddie's own browser to us.
-- They are not secrets of ours, but they are a capability to ping that device,
-- so the table is server-only like everything else in this schema.
--
-- Applied to the HUB project as caddie_push.
-- ===========================================================================

create table if not exists caddie.push_subscriptions (
  endpoint     text primary key,
  caddie_id    uuid not null references caddie.caddies(id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subs_caddie_idx
  on caddie.push_subscriptions (caddie_id);

alter table caddie.push_subscriptions enable row level security;

grant all on caddie.push_subscriptions to service_role;

update caddie.settings
   set data = data || jsonb_build_object('push_enabled', true),
       updated_at = now()
 where id = 1;

-- Clear out subscriptions no push service has accepted in a long while. Called
-- from the nightly cron alongside the other purges.
create or replace function caddie.purge_dead_push_subscriptions()
returns integer language plpgsql set search_path = caddie, pg_temp as $fn$
declare v_count integer;
begin
  with gone as (
    delete from caddie.push_subscriptions
     where last_used_at is not null
       and last_used_at < now() - interval '180 days'
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$fn$;

revoke all on function caddie.purge_dead_push_subscriptions() from anon, authenticated;
