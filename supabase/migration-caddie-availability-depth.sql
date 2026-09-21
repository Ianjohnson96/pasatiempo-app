-- ===========================================================================
-- Availability that stretches months out instead of a fortnight.
--
-- Tapping a button per day works for two weeks and collapses at three months.
-- A caddie who works most weekends and is in Mexico for a fortnight in
-- November should say those two things once, not tick ninety boxes.
--
-- So availability resolves from three layers, most specific first:
--
--   1. AWAY PERIOD  — a date range they are gone. Beats everything.
--   2. DAY OVERRIDE — caddie.availability, the existing per-date rows.
--   3. USUAL WEEK   — a standing pattern per weekday.
--   4. nothing      — genuinely unknown, which the board shows differently
--                     from a deliberate no.
--
-- The resolution itself lives in lib/caddie/data.ts rather than in SQL: it is
-- pure, the volumes are tiny, and it is the kind of precedence logic that
-- deserves tests more than it deserves a view.
--
-- Applied to the HUB project as caddie_availability_depth.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- The usual week. One row per caddie per weekday, 0 = Sunday.
-- ---------------------------------------------------------------------------
create table if not exists caddie.availability_defaults (
  caddie_id  uuid not null references caddie.caddies(id) on delete cascade,
  weekday    smallint not null,
  -- 'Off' is a standing no. A weekday with no row at all is unknown, which is
  -- a different thing and is left for the shop to chase.
  slot       text not null,
  updated_at timestamptz not null default now(),

  primary key (caddie_id, weekday),
  constraint avail_default_weekday_chk check (weekday between 0 and 6),
  constraint avail_default_slot_chk
    check (slot in ('AM', 'PM', 'All Day', 'Off'))
);

alter table caddie.availability_defaults enable row level security;
grant all on caddie.availability_defaults to service_role;

-- ---------------------------------------------------------------------------
-- Away periods. Inclusive of both ends — "I am gone the 3rd to the 17th"
-- includes the 17th, which is what anyone saying it out loud means.
-- ---------------------------------------------------------------------------
create table if not exists caddie.away_periods (
  id         uuid primary key default gen_random_uuid(),
  caddie_id  uuid not null references caddie.caddies(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  reason     text not null default '',
  created_at timestamptz not null default now(),

  constraint away_period_order_chk check (ends_on >= starts_on)
);

create index if not exists away_periods_caddie_idx
  on caddie.away_periods (caddie_id, starts_on, ends_on);

alter table caddie.away_periods enable row level security;
grant all on caddie.away_periods to service_role;

-- How far ahead the caddie calendar runs. Months, not weeks.
update caddie.settings
   set data = data || jsonb_build_object('availability_months', 3),
       updated_at = now()
 where id = 1;
