-- ============================================================================
-- Lesson Book — `lessons` schema in the HUB project.
-- Run ONCE in the HUB Supabase SQL Editor (project whzelknn…), THEN add
-- `lessons` to Settings → API → Exposed schemas.
--
-- Ian's teaching book: who he taught, when, what it cost and whether it is
-- paid. The calendar is the source of truth for WHAT HAPPENED — a sync job
-- reads Google Calendar and upserts lessons by `event_key`, so re-running it
-- never duplicates and never clobbers the money fields Ian has typed.
--
-- Money is PER LESSON. Each row carries its own `amount` and `paid`, so what a
-- student owes is simply the sum of their unpaid lessons. There are no
-- packages: a prepaid 10-pack just means ticking ten lessons paid at once.
-- `lessons.payments` is a log of money actually received (mostly imported from
-- Venmo receipt emails) used to reconcile — it is NOT what "owed" is computed
-- from. `lessons.lessons.paid` is the single source of truth for that.
--
-- Anything on the calendar that might be a lesson but matches no student lands
-- in `lessons.pending` for a yes/no rather than being guessed at. Answering
-- "no, never ask again" writes to `lessons.ignored`.
--
-- Access: app key `lessons`, single role `owner` (see lib/hub/apps.ts). A super
-- admin holds it automatically. RLS is on with no policies, so only the
-- service_role reads these tables — every route must call assertApp('lessons').
-- ============================================================================

create schema if not exists lessons;

-- ---- students -------------------------------------------------------------
-- `aliases` holds other spellings seen on the calendar ("Fred C", "Ray Gorski
-- Paid") so matching keeps working after a name is tidied up.
create table if not exists lessons.students (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  aliases     text[] not null default '{}',
  email       text,
  phone       text,
  active      boolean not null default true,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);
-- One student per name, case-insensitively.
create unique index if not exists students_name_key
  on lessons.students (lower(btrim(name)));
create index if not exists students_active_idx
  on lessons.students (active) where active;

-- ---- lessons --------------------------------------------------------------
-- `event_key` is the calendar event id plus its start time, so each occurrence
-- of a recurring booking is its own row and a re-sync updates rather than
-- inserts. `amount`/`paid` are Ian's, never touched by the sync.
create table if not exists lessons.lessons (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references lessons.students(id) on delete cascade,
  event_key   text not null unique,
  starts_at   timestamptz not null,
  minutes     int not null check (minutes between 1 and 1440),
  title       text not null default '',
  calendar    text not null default '',
  status      text not null default 'delivered'
                check (status in ('scheduled', 'delivered', 'voided', 'removed')),
  -- null means "no price set yet", which the app surfaces as needing attention.
  amount      numeric(10,2) check (amount is null or amount >= 0),
  paid        boolean not null default false,
  paid_at     timestamptz,
  -- "lesson 3 of 5", "series 2" lifted straight off the calendar title.
  series      text,
  seq         int check (seq is null or seq > 0),
  seq_of      int check (seq_of is null or seq_of > 0),
  synced_at   timestamptz not null default now(),
  -- Paid with no amount would silently count as zero income.
  constraint  paid_needs_amount check (not paid or amount is not null)
);
create index if not exists lessons_student_idx on lessons.lessons (student_id, starts_at desc);
create index if not exists lessons_starts_idx  on lessons.lessons (starts_at desc);
-- The two working lists: what still needs a price, and what is owed.
create index if not exists lessons_unpriced_idx
  on lessons.lessons (student_id) where amount is null and status = 'delivered';
create index if not exists lessons_unpaid_idx
  on lessons.lessons (student_id) where not paid and status = 'delivered';

-- ---- payments -------------------------------------------------------------
-- Money received. Venmo emails import here keyed by `source` (the Gmail
-- message id) so the importer can run repeatedly without double-logging.
-- Reconciliation only — "owed" comes from unpaid lessons, not from this.
create table if not exists lessons.payments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references lessons.students(id) on delete set null,
  received_at  timestamptz not null default now(),
  amount       numeric(10,2) not null check (amount > 0),
  method       text not null default '',
  note         text not null default '',
  source       text unique,
  created_at   timestamptz not null default now()
);
create index if not exists payments_student_idx on lessons.payments (student_id, received_at desc);

-- ---- pending (the confirm queue) -----------------------------------------
-- Calendar events that look like a lesson but match no student. Never counted
-- until confirmed; guessing here would quietly corrupt the numbers.
create table if not exists lessons.pending (
  event_key   text primary key,
  starts_at   timestamptz not null,
  minutes     int not null,
  title       text not null,
  calendar    text not null default '',
  guess       text,
  seen_at     timestamptz not null default now()
);
create index if not exists pending_starts_idx on lessons.pending (starts_at desc);

-- ---- ignored --------------------------------------------------------------
-- Titles answered "not a lesson, never ask again". Normalised so punctuation
-- and casing do not let the same thing come back.
create table if not exists lessons.ignored (
  title_norm  text primary key,
  title       text not null,
  added_at    timestamptz not null default now()
);

-- ---- lock it down ---------------------------------------------------------
-- RLS on with no policies: nothing reaches these tables except the
-- service_role, which the app uses only behind assertApp('lessons').
alter table lessons.students enable row level security;
alter table lessons.lessons  enable row level security;
alter table lessons.payments enable row level security;
alter table lessons.pending  enable row level security;
alter table lessons.ignored  enable row level security;

grant usage on schema lessons to service_role;
grant all on all tables    in schema lessons to service_role;
grant all on all sequences in schema lessons to service_role;
alter default privileges in schema lessons grant all on tables    to service_role;
alter default privileges in schema lessons grant all on sequences to service_role;

-- ---- register the app with the hub gate ----------------------------------
-- hub.access enumerates valid (app, role) pairs, so 'lessons' has to be added
-- before anyone can be granted it. Ian is a super admin and therefore already
-- holds the top role everywhere — no grant row is needed for him.
-- The live constraint is named `access_check` (verified against the database;
-- dropping a guessed name would silently leave the old one in force and the
-- new pair still rejected).
alter table hub.access drop constraint if exists access_check;
alter table hub.access add constraint access_check
  check ((app, role) in (('events','admin'),  ('events','manager'),
                         ('caddie','admin'),  ('caddie','staff'),
                         ('merch','owner'),   ('merch','staff'), ('merch','viewer'),
                         ('lessons','owner')));
