-- Lesson book dashboard, 2026-10-01. Run after migration-lessons-fixes.sql.
-- Plan: docs/superpowers/plans/2026-10-01-lesson-book-dashboard.md

-- 1. Every lesson, numbered within its package.
--
-- "Lesson 3 of 5" is worked out once, here, so the dashboard, the schedule
-- and the package cards can never disagree about it. Only completed and
-- scheduled lessons take a number; a cancelled one is still listed but does
-- not use up the package (the same rule lesson_package_status counts by).
create or replace view public.lesson_numbered
with (security_invoker = true) as
select
  l.id,
  l.client_id,
  c.name as client_name,
  coalesce(c.is_member, false) as is_member,
  l.package_id,
  p.size as package_size,
  p.label as package_label,
  p.payment_status,
  p.price_cents,
  case
    when l.package_id is not null and l.status in ('completed', 'scheduled')
    then count(*) filter (where l.status in ('completed', 'scheduled'))
           over (partition by l.package_id order by l.starts_at, l.id)
  end as seq,
  l.starts_at,
  l.ends_at,
  l.status,
  l.title_raw,
  l.calendar_uid
from public.lessons l
left join public.lesson_clients c on c.id = l.client_id
left join public.lesson_packages p on p.id = l.package_id;

-- 2. Settings: standard package prices, size -> cents, e.g. {"5": 50000}.
-- One row. Most packages sell at the standard price; the few that do not are
-- simply edited on the package itself.
create table if not exists public.lesson_settings (
  id int primary key default 1 check (id = 1),
  standard_prices jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.lesson_settings enable row level security;
drop policy if exists lesson_settings_owner on public.lesson_settings;
create policy lesson_settings_owner on public.lesson_settings
  for all
  using ((select public.lesson_is_owner()))
  with check ((select public.lesson_is_owner()));
revoke all on public.lesson_settings from anon;
grant select, insert, update on public.lesson_settings to authenticated;
insert into public.lesson_settings (id) values (1) on conflict (id) do nothing;

-- 3. The whole front page in one round trip.
--
-- security invoker: it runs as the signed-in user, so RLS still decides what
-- comes back and a stranger gets empty lists. Every boundary - today, this
-- week, this month, the season - is Pacific, not the server's UTC.
create or replace function public.lesson_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with b as (
  select
    now() as now_ts,
    d as today,
    (d::timestamp at time zone 'America/Los_Angeles') as day_start,
    ((d + 7)::timestamp at time zone 'America/Los_Angeles') as week_end,
    date_trunc('month', d::timestamp) as month_start,
    date_trunc('year', d::timestamp) as season_start,
    (date_trunc('year', d::timestamp) at time zone 'America/Los_Angeles') as season_start_ts
  from (select (now() at time zone 'America/Los_Angeles')::date as d) t
)
select jsonb_build_object(
  'now', (select now_ts from b),

  'next', (
    select to_jsonb(n) from lesson_numbered n, b
    where n.status = 'scheduled' and n.starts_at > b.now_ts
    order by n.starts_at limit 1),

  'week', coalesce((
    select jsonb_agg(to_jsonb(n) order by n.starts_at) from lesson_numbered n, b
    where n.starts_at >= b.day_start and n.starts_at < b.week_end
      and n.status <> 'cancelled'), '[]'::jsonb),

  'money', (
    select jsonb_build_object(
      'owed_cents', coalesce(sum(p.price_cents) filter (where p.payment_status = 'unpaid'), 0),
      'pending_cents', coalesce(sum(p.price_cents) filter (where p.payment_status = 'pending'), 0),
      'unpaid_count', count(*) filter (where p.payment_status = 'unpaid'),
      'pending_count', count(*) filter (where p.payment_status = 'pending'),
      'collected_month_cents', coalesce(sum(p.price_cents) filter (
        where p.payment_status = 'paid' and p.paid_on >= b.month_start::date), 0),
      'collected_season_cents', coalesce(sum(p.price_cents) filter (
        where p.payment_status = 'paid' and p.paid_on >= b.season_start::date), 0),
      'unpriced', count(*) filter (where p.price_cents is null))
    from lesson_packages p, b),

  'running_out', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.lessons_remaining, s.last_lesson_at desc nulls last)
    from lesson_package_status s
    where not s.is_complete and s.lessons_remaining <= 1), '[]'::jsonb),

  'unpaid', coalesce((
    select jsonb_agg(to_jsonb(s) order by s.sold_on nulls last, s.client_name)
    from lesson_package_status s
    where s.payment_status = 'unpaid'), '[]'::jsonb),

  -- Lapsed, but recently enough to be worth a call: last taught 30 to 180
  -- days ago and nothing booked. Further back than that is not a follow-up.
  'not_seen', coalesce((
    select jsonb_agg(x order by x.last_lesson_at desc) from (
      select c.id, c.name,
             max(l.starts_at) filter (where l.status = 'completed') as last_lesson_at
      from lesson_clients c
      join lessons l on l.client_id = c.id
      where c.active
      group by c.id, c.name
      having max(l.starts_at) filter (where l.status = 'completed') < now() - interval '30 days'
         and max(l.starts_at) filter (where l.status = 'completed') >= now() - interval '180 days'
         and count(*) filter (where l.status = 'scheduled' and l.starts_at > now()) = 0
    ) x), '[]'::jsonb),

  -- Thirteen months ending this one, so "same month last year" is in reach.
  -- Empty months are zero rows, not gaps.
  'months', (
    select jsonb_agg(jsonb_build_object(
             'month', to_char(m, 'YYYY-MM'),
             'lessons', coalesce(ls.n, 0),
             'revenue_cents', coalesce(rv.c, 0)) order by m)
    from b,
         generate_series(b.month_start - interval '12 months', b.month_start, interval '1 month') m
    left join lateral (
      select count(*) as n from lessons l
      where l.status in ('completed', 'scheduled')
        and date_trunc('month', l.starts_at at time zone 'America/Los_Angeles') = m) ls on true
    left join lateral (
      select sum(p.price_cents) as c from lesson_packages p
      where p.payment_status = 'paid'
        and date_trunc('month', p.paid_on::timestamp) = m) rv on true),

  'split', (
    select jsonb_build_object(
      'member', count(*) filter (where n.is_member),
      'guest', count(*) filter (where not n.is_member))
    from lesson_numbered n, b
    where n.status in ('completed', 'scheduled') and n.client_id is not null
      and n.starts_at >= b.season_start_ts),

  'top_clients', coalesce((
    select jsonb_agg(x order by x.lessons desc, x.name) from (
      select n.client_id as id, n.client_name as name, count(*) as lessons
      from lesson_numbered n, b
      where n.status in ('completed', 'scheduled') and n.client_id is not null
        and n.starts_at >= b.season_start_ts
      group by n.client_id, n.client_name
      order by count(*) desc, n.client_name
      limit 5) x), '[]'::jsonb),

  'sync', (
    select jsonb_build_object('last_synced_at', s.last_synced_at, 'last_status', s.last_status)
    from lesson_calendar_sync s where s.source = 'm365' limit 1),

  'review_count', (select count(*) from lesson_review where not dismissed),

  'standard_prices', coalesce(
    (select standard_prices from lesson_settings where id = 1), '{}'::jsonb)
);
$$;

revoke all on function public.lesson_dashboard() from public, anon;
grant execute on function public.lesson_dashboard() to authenticated;
