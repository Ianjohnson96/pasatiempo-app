-- ============================================================================
-- Hub activity log — who changed access, passwords, site switches and
-- month-end data, and when. Written by lib/hub/log.ts; shown to the super
-- admin at /admin/activity. Run ONCE in the HUB project (hub is already exposed).
-- ============================================================================

create table if not exists hub.activity (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text,                       -- who did it (email); null = the system
  app     text,                       -- events | caddie | merch | hub | sites
  action  text not null,              -- e.g. access.grant, site.off, password.set
  target  text,                       -- the person (email) or site it was done to
  detail  jsonb not null default '{}'
);
create index if not exists activity_at_idx on hub.activity (at desc);
alter table hub.activity enable row level security;
grant all on hub.activity to service_role;
