-- ============================================================================
-- Clinic financials — per-person payment, event finance settings, prize log.
-- Applied to the HUB project (whzelknn...) on 2026-08-21, schema `events`.
--
-- All money is stored as integer CENTS. Dollar floats produce payout totals
-- that don't reconcile, which is the one thing a payout sheet must always do.
-- ============================================================================

-- ---- one payment per person, on their sign-up ---------------------------
alter table events.registrations
  add column if not exists paid         boolean not null default false,
  add column if not exists fee_cents    integer,   -- null = use the event default
  add column if not exists tender       text,      -- cash | check | venmo | zelle
  add column if not exists paid_on      date,
  add column if not exists payment_note text default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'registrations_tender_chk'
  ) then
    alter table events.registrations
      add constraint registrations_tender_chk
      check (tender is null or tender in ('cash','check','venmo','zelle'));
  end if;
end $$;

-- ---- per-event finance settings -----------------------------------------
-- Deliberately NOT columns on events.events: the public event page serialises
-- the event row into client components, so anything stored there is readable
-- by every visitor.
create table if not exists events.event_finance (
  event_id            uuid primary key references events.events(id) on delete cascade,
  fee_cents           integer not null default 32000,   -- $320 a head
  organizer_name      text    not null default '',
  organizer_cut_cents integer not null default 0,       -- taken off the top
  instructors         jsonb   not null default '[]'::jsonb,  -- [{id,name}]
  presence            jsonb   not null default '{}'::jsonb,  -- {slotId: [instructorId]}
  updated_at          timestamptz default now()
);

-- ---- prizes bought out of the pot --------------------------------------
create table if not exists events.prize_purchases (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events.events(id) on delete cascade,
  purchased_on date,
  description  text    not null default '',
  amount_cents integer not null default 0,
  created_at   timestamptz default now()
);

create index if not exists prize_purchases_event_id_idx
  on events.prize_purchases(event_id);

-- RLS on with no policies: unreachable by anon/authenticated, reachable only
-- through the server-side service_role client, same as every other table here.
alter table events.event_finance   enable row level security;
alter table events.prize_purchases enable row level security;

grant all on events.event_finance   to service_role;
grant all on events.prize_purchases to service_role;
