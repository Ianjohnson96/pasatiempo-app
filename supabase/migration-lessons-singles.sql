-- Lesson book: single lessons billed on their own, 2026-10-01.
-- Run after migration-lessons-dashboard.sql (then re-run its function).
--
-- A single is a one-lesson bill: a lesson_packages row with kind = 'single'
-- and size 1. Reusing the package row is deliberate - price, paid / pending /
-- unpaid, payment method, owed, collected and the income export all already
-- work on packages - and one row per single is what keeps two singles from
-- ever being bundled together.

alter table public.lesson_packages
  add column if not exists kind text not null default 'package'
  check (kind in ('package', 'single'));

-- {"member": cents, "guest": cents}; either may be missing.
alter table public.lesson_settings
  add column if not exists single_rates jsonb not null default '{}'::jsonb;

-- New columns go at the end: create or replace view cannot reorder.
-- paid_on and notes were missing from this view, so a card could never show
-- when a package was paid; they are added here too.
create or replace view public.lesson_package_status
with (security_invoker = true) as
select
  p.id as package_id,
  p.client_id,
  c.name as client_name,
  p.label,
  p.size,
  p.price_cents,
  p.sold_on,
  p.payment_method,
  p.payment_status,
  count(l.id) filter (where l.status = 'completed') as lessons_used,
  p.size - count(l.id) filter (where l.status = 'completed') as lessons_remaining,
  count(l.id) filter (where l.status = 'scheduled') as lessons_booked,
  max(l.starts_at) filter (where l.status = 'completed') as last_lesson_at,
  (p.size - count(l.id) filter (where l.status = 'completed')) <= 0 as is_complete,
  p.paid_on,
  p.notes,
  p.kind,
  coalesce(c.is_member, false) as client_is_member
from public.lesson_packages p
join public.lesson_clients c on c.id = p.client_id
left join public.lessons l on l.package_id = p.id
group by p.id, c.name, c.is_member;

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
  l.calendar_uid,
  l.notes,
  l.calendar_source,
  p.kind as package_kind
from public.lessons l
left join public.lesson_clients c on c.id = l.client_id
left join public.lesson_packages p on p.id = l.package_id;

-- The front page, now aware of singles: Running out is for packages only (a
-- single is never "about to run out"), and lessons on no bill yet are counted
-- so they cannot be forgotten.
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
    (date_trunc('year', d::timestamp) at time zone 'America/Los_Angeles') as season_start_ts,
    -- Upper bound too: in December, January lessons already on the books
    -- belong to next season, not this one.
    ((date_trunc('year', d::timestamp) + interval '1 year')
       at time zone 'America/Los_Angeles') as season_end_ts
  from (select (now() at time zone 'America/Los_Angeles')::date as d) t
)
select jsonb_build_object(
  'now', (select now_ts from b),

  'next', (
    select to_jsonb(n) from lesson_numbered n, b
    where n.status = 'scheduled' and n.starts_at > b.now_ts
    order by n.starts_at limit 1),

  -- What was worked on last time with whoever is next, to glance at first.
  'next_last_note', (
    select jsonb_build_object('notes', l.notes, 'starts_at', l.starts_at)
    from lessons l
    where l.client_id = (
        select n.client_id from lesson_numbered n, b
        where n.status = 'scheduled' and n.starts_at > b.now_ts
        order by n.starts_at limit 1)
      and l.status = 'completed'
      and l.notes is not null and btrim(l.notes) <> ''
    order by l.starts_at desc limit 1),

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

  -- With the client's phone, for the "time for the next package" text.
  'running_out', coalesce((
    select jsonb_agg(to_jsonb(s) || jsonb_build_object('client_phone', c.phone)
                     order by s.lessons_remaining, s.last_lesson_at desc nulls last)
    from lesson_package_status s
    join lesson_clients c on c.id = s.client_id
    where s.kind = 'package'
      and not s.is_complete and s.lessons_remaining <= 1), '[]'::jsonb),

  -- Collected this season, split by how it was paid ("none" = not recorded).
  'collected_by_method', coalesce((
    select jsonb_object_agg(x.method, x.cents) from (
      select coalesce(p.payment_method, 'none') as method, sum(p.price_cents) as cents
      from lesson_packages p, b
      where p.payment_status = 'paid' and p.price_cents is not null
        and p.paid_on >= b.season_start::date
      group by 1) x), '{}'::jsonb),

  -- Taught or booked but on no bill yet: neither in a package nor a single.
  'unbilled', (
    select jsonb_build_object('lessons', count(*), 'clients', count(distinct l.client_id))
    from lessons l
    where l.package_id is null and l.client_id is not null
      and l.status in ('completed', 'scheduled')),

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
      and n.starts_at >= b.season_start_ts and n.starts_at < b.season_end_ts),

  'top_clients', coalesce((
    select jsonb_agg(x order by x.lessons desc, x.name) from (
      select n.client_id as id, n.client_name as name, count(*) as lessons
      from lesson_numbered n, b
      where n.status in ('completed', 'scheduled') and n.client_id is not null
        and n.starts_at >= b.season_start_ts and n.starts_at < b.season_end_ts
      group by n.client_id, n.client_name
      order by count(*) desc, n.client_name
      limit 5) x), '[]'::jsonb),

  'sync', (
    select jsonb_build_object('last_synced_at', s.last_synced_at, 'last_status', s.last_status)
    from lesson_calendar_sync s where s.source = 'm365' limit 1),

  'review_count', (select count(*) from lesson_review where not dismissed),

  'standard_prices', coalesce(
    (select standard_prices from lesson_settings where id = 1), '{}'::jsonb),

  'single_rates', coalesce(
    (select single_rates from lesson_settings where id = 1), '{}'::jsonb)
);
$$;

revoke all on function public.lesson_dashboard() from public, anon;
grant execute on function public.lesson_dashboard() to authenticated;

-- The roster's "not billed" count, so the clients with lessons on no bill
-- can be sorted to the top and worked through. Appended at the end.
create or replace view public.lesson_client_summary
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.is_member,
  c.active,
  coalesce(l.total_lessons, 0) as total_lessons,
  l.last_lesson_at,
  coalesce(p.package_count, 0) as package_count,
  coalesce(p.owed_cents, 0)::bigint as owed_cents,
  coalesce(l.unbilled, 0) as unbilled_lessons
from public.lesson_clients c
left join (
  select client_id,
         count(*) as total_lessons,
         max(starts_at) filter (where status = 'completed') as last_lesson_at,
         count(*) filter (where package_id is null
                            and status in ('completed', 'scheduled')) as unbilled
  from public.lessons
  group by client_id
) l on l.client_id = c.id
left join (
  select client_id,
         count(*) filter (where kind = 'package') as package_count,
         sum(price_cents) filter (where payment_status = 'unpaid') as owed_cents
  from public.lesson_packages
  group by client_id
) p on p.client_id = c.id;
