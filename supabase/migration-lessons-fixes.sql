-- Lesson book fixes, 2026-10-01. Run after migration-lessons-schema.sql.

-- 1. ON CONFLICT (calendar_uid) needs a real unique constraint.
--
-- The partial index (WHERE calendar_uid IS NOT NULL) could not be inferred
-- from the bare ON CONFLICT that PostgREST sends, so every sync upsert and
-- every "It's a lesson" failed with "no unique or exclusion constraint
-- matching the ON CONFLICT specification". A plain unique constraint still
-- allows any number of NULLs (the seeded rows), so nothing is lost by
-- dropping the predicate.
drop index if exists public.lessons_calendar_uid_key;
alter table public.lessons
  add constraint lessons_calendar_uid_key unique (calendar_uid);

-- 2. lesson_client_summary joined lessons AND packages to the client in one
-- pass, so every lesson was repeated once per package: Meredith Hoffman read
-- 150 lessons instead of 25, and owed_cents was multiplied by the lesson
-- count. Aggregate each side on its own, then join.
--
-- last_lesson_at is the last lesson actually taught; a booked one next month
-- is not "last seen".
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
  coalesce(p.owed_cents, 0)::bigint as owed_cents
from public.lesson_clients c
left join (
  select client_id,
         count(*) as total_lessons,
         max(starts_at) filter (where status = 'completed') as last_lesson_at
  from public.lessons
  group by client_id
) l on l.client_id = c.id
left join (
  select client_id,
         count(*) as package_count,
         -- Unpaid only. A pending member charge is money in flight, not
         -- owed - the dashboard keeps the two apart, and so must this.
         sum(price_cents) filter (where payment_status = 'unpaid') as owed_cents
  from public.lesson_packages
  group by client_id
) p on p.client_id = c.id;

-- 3. Evaluate the owner check once per query, not once per row. Wrapping the
-- call in a scalar subquery lets the planner cache it as an initplan.
alter policy lesson_clients_owner on public.lesson_clients
  using ((select public.lesson_is_owner()))
  with check ((select public.lesson_is_owner()));
alter policy lesson_packages_owner on public.lesson_packages
  using ((select public.lesson_is_owner()))
  with check ((select public.lesson_is_owner()));
alter policy lessons_owner on public.lessons
  using ((select public.lesson_is_owner()))
  with check ((select public.lesson_is_owner()));
alter policy lesson_review_owner on public.lesson_review
  using ((select public.lesson_is_owner()))
  with check ((select public.lesson_is_owner()));
alter policy lesson_sync_owner on public.lesson_calendar_sync
  using ((select public.lesson_is_owner()))
  with check ((select public.lesson_is_owner()));
