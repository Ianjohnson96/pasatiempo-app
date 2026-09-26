-- ============================================================================
-- Hub access — who can use which staff app, and which public sites are on.
-- Run ONCE in the HUB Supabase SQL Editor (project whzelknn…), THEN add `hub`
-- to Settings → API → Exposed schemas.
--
-- One sign-in (Supabase Auth) for all staff. Access is granted per app:
--   events : admin (every event, financials) | manager (own / co-managed events)
--   caddie : admin (adds the fair-share ledger) | staff (dispatch board, roster, rates, tiers)
--   merch  : owner (forecast, budgets, brand calls, month-end data) | staff | viewer
-- A super admin has every app at its top role, manages people for all apps,
-- and switches public sites on and off. App admins/owners manage people for
-- their own app only. Code: lib/hub/access.ts.
--
-- Replaces events.app_admins and merch.members (copied below, left in place,
-- no longer read).
-- ============================================================================

create schema if not exists hub;

create table if not exists hub.people (
  email        text primary key check (email = lower(email)),
  name         text not null default '',
  super_admin  boolean not null default false,
  active       boolean not null default true,
  created_by   text,
  created_at   timestamptz not null default now()
);

create table if not exists hub.access (
  email       text not null references hub.people(email) on delete cascade on update cascade,
  app         text not null,
  role        text not null,
  granted_by  text,
  granted_at  timestamptz not null default now(),
  primary key (email, app),
  check ((app, role) in (('events','admin'), ('events','manager'),
                         ('caddie','admin'), ('caddie','staff'),
                         ('merch','owner'), ('merch','staff'), ('merch','viewer')))
);

-- Public sites the super admin can take offline. Off = visitors see a
-- "not available" page; super admins still see the site.
create table if not exists hub.sites (
  key         text primary key check (key in ('events', 'mhi', 'sombrero')),
  label       text not null,
  enabled     boolean not null default true,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table hub.people enable row level security;
alter table hub.access enable row level security;
alter table hub.sites  enable row level security;

grant usage on schema hub to anon, authenticated, service_role;
grant all on all tables    in schema hub to service_role;
grant all on all sequences in schema hub to service_role;
alter default privileges in schema hub grant all on tables    to service_role;
alter default privileges in schema hub grant all on sequences to service_role;

-- ---- seed ----------------------------------------------------------------
insert into hub.sites (key, label) values
  ('events', 'Event pages (sign-ups)'),
  ('mhi', 'Marion Hollins Invitational'),
  ('sombrero', 'El Sombrero')
on conflict (key) do nothing;

insert into hub.people (email, name, super_admin, created_by)
values ('ijohnson@pasatiempo.com', 'Ian Johnson', true, 'migration')
on conflict (email) do update set super_admin = true;

-- Everyone who had access before keeps it.
insert into hub.people (email, created_by)
  select lower(email), 'migration' from events.app_admins
  on conflict (email) do nothing;
insert into hub.access (email, app, role, granted_by)
  select lower(email), 'events', 'admin', 'migration' from events.app_admins
  on conflict (email, app) do nothing;

insert into hub.people (email, name, active, created_by)
  select email, name, active, 'migration' from merch.members
  on conflict (email) do nothing;
insert into hub.access (email, app, role, granted_by)
  select email, 'merch', role, 'migration' from merch.members
  on conflict (email, app) do nothing;
