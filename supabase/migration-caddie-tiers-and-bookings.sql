-- ===========================================================================
-- Caddie tiers you define, and bookings that group tee times together.
--
-- Three changes, all driven by how the club actually works:
--
-- 1. TIERS. Honor/A/B was a guess baked into a check constraint. Seniority
--    here is the shop's own ladder — shop guys, then veterans, then whoever
--    else — so tiers become rows the Pro Shop edits, with an explicit order
--    that drives dispatch. Seeded from the existing three so the one real
--    roster row survives; rename them on the Tiers page.
--
-- 2. BOOKINGS. A party of twelve wanting forecaddies across the 12:00, 12:10
--    and 12:20 is one phone call and one decision, not three unrelated jobs.
--    Loops now hang off a booking so the board can show them together.
--
-- 3. REQUESTS COME OUT. The club does not take "I want caddie X" or "I want an
--    A-rank" requests, so loops.requested_rank and loops.requested_caddie_id
--    are dropped rather than left as dead columns the ranking code reads.
--
-- Applied to the HUB project as caddie_tiers_and_bookings.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Tiers
-- ---------------------------------------------------------------------------
create table if not exists caddie.tiers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  -- Lower goes out first. Gaps are deliberate: they make reordering cheap.
  sort_order  integer not null,
  description text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tiers_order_idx on caddie.tiers (sort_order);

drop trigger if exists tiers_touch on caddie.tiers;
create trigger tiers_touch before update on caddie.tiers
  for each row execute function caddie.set_updated_at();

alter table caddie.tiers enable row level security;
grant all on caddie.tiers to service_role;

-- Seed from what the rank column already held, so nothing is orphaned.
insert into caddie.tiers (name, sort_order, description)
values
  ('Honor', 10, 'Most senior. Offered loops first.'),
  ('A',     20, ''),
  ('B',     30, '')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Caddies point at a tier instead of carrying a fixed letter
-- ---------------------------------------------------------------------------
alter table caddie.caddies
  add column if not exists tier_id uuid references caddie.tiers(id) on delete set null;

update caddie.caddies c
   set tier_id = t.id
  from caddie.tiers t
 where c.tier_id is null
   and t.name = c.rank;

create index if not exists caddies_tier_idx on caddie.caddies (tier_id);

alter table caddie.caddies drop constraint if exists caddies_rank_chk;
alter table caddie.caddies drop column if exists rank;

-- ---------------------------------------------------------------------------
-- 3. Bookings: one party, several tee times
-- ---------------------------------------------------------------------------
create table if not exists caddie.bookings (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  notes      text not null default '',
  created_by text,
  created_at timestamptz not null default now()
);

alter table caddie.bookings enable row level security;
grant all on caddie.bookings to service_role;

alter table caddie.loops
  add column if not exists booking_id uuid references caddie.bookings(id) on delete set null;

create index if not exists loops_booking_idx on caddie.loops (booking_id);

-- ---------------------------------------------------------------------------
-- 4. Requests come out
-- ---------------------------------------------------------------------------
alter table caddie.loops drop constraint if exists loops_rank_chk;
alter table caddie.loops drop column if exists requested_rank;
alter table caddie.loops drop column if exists requested_caddie_id;
