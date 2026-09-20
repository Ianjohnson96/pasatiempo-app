-- ===========================================================================
-- Hub schema for the Caddie section ("CaddiePro").
--
-- Run in the HUB Supabase project (the same project Event Planner and MHI use).
-- Follows the house pattern established by schema-mhi.sql:
--   * one isolated Postgres schema per section
--   * RLS ON with NO policies -> only service_role (our server code) can read
--   * text + check constraints rather than enums, so values can change later
--   * money as integer CENTS (see migration-clinic-finance.sql)
--
-- This section is the first with NON-STAFF users. Caddies do not get rows in
-- auth.users: they are identified by a signed cookie backed by caddie.sessions,
-- minted when they tap a link we texted or emailed them. Staff auth is
-- unchanged (Supabase Auth + events.app_admins via lib/events/auth.ts).
--
-- AFTER running: Dashboard -> Settings -> API -> Exposed schemas -> add "caddie"
-- ===========================================================================

create schema if not exists caddie;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function caddie.set_updated_at()
returns trigger language plpgsql set search_path = caddie, pg_temp as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- settings — single row, same shape as mhi.settings
-- ---------------------------------------------------------------------------
create table if not exists caddie.settings (
  id         integer primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint caddie_settings_singleton check (id = 1)
);

insert into caddie.settings (id, data)
values (1, jsonb_build_object(
  'course_timezone',          'America/Los_Angeles',
  'offer_expiry_minutes',     30,   -- a direct offer auto-expires after this
  'broadcast_expiry_minutes', 20,   -- the "first to respond" window
  'reminder_hours_before',    12,
  'overlap_guard_hours',      4,    -- min gap between one caddie's accepted loops
  'session_days',             90,   -- caddie cookie lifetime
  'email_enabled',            true,
  'sms_enabled',              false, -- flip on once Twilio 10DLC clears

  -- The caddie rate card, in CENTS, keyed by loop type then hole count.
  -- Money never moves through this app: the player pays the caddie directly.
  -- These figures are shown so both sides know the number before the loop.
  -- Seeded at zero on purpose — a wrong rate on a caddie's phone is worse
  -- than a blank one. The Pro Shop sets them at /admin/caddie/rates.
  'rates', jsonb_build_object(
    'Single Caddie', jsonb_build_object('18', 0, '9', 0),
    'Double Bag',    jsonb_build_object('18', 0, '9', 0),
    'Forecaddie',    jsonb_build_object('18', 0, '9', 0)
  )
))
on conflict (id) do nothing;

create or replace function caddie.setting(p_key text)
returns jsonb language sql stable set search_path = caddie, pg_temp as $fn$
  select data -> p_key from caddie.settings where id = 1;
$fn$;

-- ---------------------------------------------------------------------------
-- caddies — the roster. Deliberately NOT tied to auth.users.
-- ---------------------------------------------------------------------------
create table if not exists caddie.caddies (
  id                       uuid primary key default gen_random_uuid(),
  full_name                text not null,
  phone                    text unique,          -- E.164, e.g. +14155550123
  email                    text unique,
  rank                     text not null default 'B',
  status                   text not null default 'Active',
  preferred_contact_method text not null default 'Both',
  sms_opt_in               boolean not null default false,
  sms_opt_out_at           timestamptz,
  last_worked_on           date,
  notes                    text not null default '',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint caddies_rank_chk   check (rank   in ('Honor', 'A', 'B')),
  constraint caddies_status_chk check (status in ('Active', 'Inactive', 'Suspended')),
  constraint caddies_contact_chk
    check (preferred_contact_method in ('SMS', 'Email', 'Both')),
  constraint caddies_phone_e164
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- Must be reachable by whatever they asked to be reached on.
  constraint caddies_reachable_chk
    check (
      (preferred_contact_method = 'SMS'   and phone is not null)
      or (preferred_contact_method = 'Email' and email is not null)
      or (preferred_contact_method = 'Both'  and (phone is not null or email is not null))
    )
);

create index if not exists caddies_status_idx on caddie.caddies (status);
create index if not exists caddies_dispatch_idx
  on caddie.caddies (rank, last_worked_on nulls first)
  where status = 'Active';

drop trigger if exists caddies_touch on caddie.caddies;
create trigger caddies_touch before update on caddie.caddies
  for each row execute function caddie.set_updated_at();

-- ---------------------------------------------------------------------------
-- sessions — the caddie cookie. One row per device, renewable, revocable.
-- Only the sha256 of the cookie value is stored, so a database leak cannot be
-- replayed as a login.
-- ---------------------------------------------------------------------------
create table if not exists caddie.sessions (
  token_hash   text primary key,
  caddie_id    uuid not null references caddie.caddies(id) on delete cascade,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz,
  revoked_at   timestamptz,
  user_agent   text
);

create index if not exists sessions_caddie_idx on caddie.sessions (caddie_id);
create index if not exists sessions_expiry_idx on caddie.sessions (expires_at);

-- ---------------------------------------------------------------------------
-- availability — one row per caddie / date / slot
-- ---------------------------------------------------------------------------
create table if not exists caddie.availability (
  id         uuid primary key default gen_random_uuid(),
  caddie_id  uuid not null references caddie.caddies(id) on delete cascade,
  date       date not null,
  time_slot  text not null,
  status     text not null default 'Pending',
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint availability_slot_chk   check (time_slot in ('AM', 'PM', 'All Day')),
  constraint availability_status_chk check (status in ('Available', 'Unavailable', 'Pending')),
  unique (caddie_id, date, time_slot)
);

create index if not exists availability_lookup_idx
  on caddie.availability (date, time_slot, status);

drop trigger if exists availability_touch on caddie.availability;
create trigger availability_touch before update on caddie.availability
  for each row execute function caddie.set_updated_at();

-- ---------------------------------------------------------------------------
-- loops — a job that needs one or more caddies
--
-- Loops are entered by hand in the Pro Shop for now. The Jonas CSV import
-- (an import_batches table, plus an external_ref dedupe key on this table)
-- lands later as its own migration, the way migration-clinic-finance.sql
-- extended the events schema after the fact.
-- ---------------------------------------------------------------------------
create table if not exists caddie.loops (
  id                  uuid primary key default gen_random_uuid(),
  tee_time            timestamptz not null,
  player_name         text not null,
  loop_type           text not null default 'Single Caddie',
  caddies_required    smallint not null default 1,
  holes               smallint not null default 18,
  notes               text not null default '',
  requested_rank      text,          -- structured form of "member requests A-rank"
  requested_caddie_id uuid references caddie.caddies(id) on delete set null,
  status              text not null default 'Unassigned',
  open_board          boolean not null default false,  -- visible on the caddie job board
  source              text not null default 'manual',
  created_by          text,          -- admin email
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint loops_type_chk   check (loop_type in ('Single Caddie', 'Double Bag', 'Forecaddie')),
  constraint loops_count_chk  check (caddies_required between 1 and 8),
  constraint loops_holes_chk  check (holes in (9, 18, 27, 36)),
  constraint loops_rank_chk   check (requested_rank is null or requested_rank in ('Honor', 'A', 'B')),
  constraint loops_source_chk check (source in ('manual', 'csv')),
  constraint loops_status_chk check (status in
    ('Unassigned', 'Partially Assigned', 'Assigned', 'Completed', 'Cancelled'))
);

create index if not exists loops_tee_time_idx    on caddie.loops (tee_time);
create index if not exists loops_status_time_idx on caddie.loops (status, tee_time);

-- ---------------------------------------------------------------------------
-- assignments — an OFFER to one caddie for one loop.
--
-- Named offered_at rather than assigned_at because a row exists from the moment
-- we ask; it only becomes a real assignment when confirmation_status='Accepted'.
-- ---------------------------------------------------------------------------
create table if not exists caddie.assignments (
  id                  uuid primary key default gen_random_uuid(),
  loop_id             uuid not null references caddie.loops(id)   on delete cascade,
  caddie_id           uuid not null references caddie.caddies(id) on delete cascade,
  offered_at          timestamptz not null default now(),
  offered_by          text,                          -- admin email, null = system broadcast
  offer_kind          text not null default 'direct',
  offer_expires_at    timestamptz,
  confirmation_status text not null default 'Pending',
  responded_at        timestamptz,
  response_channel    text,
  allow_overlap       boolean not null default false, -- admin override of the gap guard
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint assignments_kind_chk    check (offer_kind in ('direct', 'broadcast')),
  constraint assignments_status_chk  check (confirmation_status in
    ('Pending', 'Accepted', 'Declined', 'Expired', 'Withdrawn')),
  constraint assignments_channel_chk check (response_channel is null
    or response_channel in ('sms', 'email', 'web', 'admin')),
  unique (loop_id, caddie_id)
);

create index if not exists assignments_caddie_idx  on caddie.assignments (caddie_id, confirmation_status);
create index if not exists assignments_loop_idx    on caddie.assignments (loop_id);
create index if not exists assignments_pending_idx on caddie.assignments (offer_expires_at)
  where confirmation_status = 'Pending';

drop trigger if exists assignments_touch on caddie.assignments;
create trigger assignments_touch before update on caddie.assignments
  for each row execute function caddie.set_updated_at();

-- ---------------------------------------------------------------------------
-- offer_tokens — one-tap accept/decline links that work without a session
-- ---------------------------------------------------------------------------
create table if not exists caddie.offer_tokens (
  token_hash    text primary key,     -- sha256 of the value in the URL
  assignment_id uuid not null references caddie.assignments(id) on delete cascade,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists offer_tokens_assignment_idx on caddie.offer_tokens (assignment_id);

-- ---------------------------------------------------------------------------
-- notification_logs / inbound_messages
-- ---------------------------------------------------------------------------
create table if not exists caddie.notification_logs (
  id                  uuid primary key default gen_random_uuid(),
  caddie_id           uuid references caddie.caddies(id)     on delete set null,
  assignment_id       uuid references caddie.assignments(id) on delete set null,
  loop_id             uuid references caddie.loops(id)       on delete set null,
  channel             text not null,            -- SMS | Email
  template_key        text,                     -- job_offer | broadcast | reminder | filled
  to_address          text not null,            -- E.164 phone or email address
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'Queued',
  provider            text,                     -- twilio | resend
  provider_message_id text,
  error               text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),

  constraint notification_channel_chk check (channel in ('SMS', 'Email')),
  constraint notification_status_chk  check (status in ('Queued', 'Sent', 'Failed'))
);

create unique index if not exists notification_provider_msg_key
  on caddie.notification_logs (provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists notification_caddie_idx
  on caddie.notification_logs (caddie_id, created_at desc);

-- Inbound SMS. Unique on the provider id so Twilio's retries are idempotent —
-- a retried webhook must not accept the same loop twice.
create table if not exists caddie.inbound_messages (
  id                    uuid primary key default gen_random_uuid(),
  provider              text not null default 'twilio',
  provider_message_id   text not null,
  from_number           text not null,
  to_number             text,
  body                  text,
  matched_caddie_id     uuid references caddie.caddies(id)     on delete set null,
  matched_assignment_id uuid references caddie.assignments(id) on delete set null,
  parsed_intent         text,   -- ACCEPT | DECLINE | STOP | START | HELP | UNKNOWN
  outcome               text,
  received_at           timestamptz not null default now(),
  unique (provider, provider_message_id)
);

create index if not exists inbound_from_idx
  on caddie.inbound_messages (from_number, received_at desc);

-- ---------------------------------------------------------------------------
-- Business rules — derived loop status, capacity, double-booking
-- ---------------------------------------------------------------------------
-- Loop status is always DERIVED from accepted assignments. Nothing sets it by
-- hand except an admin marking Completed or Cancelled.
create or replace function caddie.refresh_loop_status(p_loop_id uuid)
returns void language plpgsql set search_path = caddie, pg_temp as $fn$
declare
  v_required int;
  v_accepted int;
  v_current  text;
begin
  select caddies_required, status into v_required, v_current
    from caddie.loops where id = p_loop_id;

  if v_current is null or v_current in ('Completed', 'Cancelled') then
    return;
  end if;

  select count(*) into v_accepted
    from caddie.assignments
   where loop_id = p_loop_id and confirmation_status = 'Accepted';

  update caddie.loops
     set status = case
                    when v_accepted = 0            then 'Unassigned'
                    when v_accepted >= v_required  then 'Assigned'
                    else 'Partially Assigned'
                  end,
         open_board = case when v_accepted >= v_required then false else open_board end
   where id = p_loop_id;
end;
$fn$;

create or replace function caddie.guard_assignment()
returns trigger language plpgsql set search_path = caddie, pg_temp as $fn$
declare
  v_loop     caddie.loops%rowtype;
  v_accepted int;
  v_status   text;
  v_gap      interval;
begin
  select * into v_loop from caddie.loops where id = new.loop_id for update;

  if v_loop.status = 'Cancelled' then
    raise exception 'Cannot offer a cancelled loop';
  end if;

  if TG_OP = 'INSERT' then
    select status into v_status from caddie.caddies where id = new.caddie_id;
    if v_status <> 'Active' then
      raise exception 'Caddie is % and cannot be offered loops', v_status;
    end if;
  end if;

  if new.confirmation_status = 'Accepted'
     and (TG_OP = 'INSERT' or old.confirmation_status is distinct from 'Accepted') then

    select count(*) into v_accepted
      from caddie.assignments
     where loop_id = new.loop_id
       and confirmation_status = 'Accepted'
       and id <> new.id;

    if v_accepted >= v_loop.caddies_required then
      raise exception 'Loop % is already filled (% of %)',
        new.loop_id, v_accepted, v_loop.caddies_required
        using errcode = 'unique_violation';
    end if;

    if not new.allow_overlap then
      v_gap := make_interval(hours => (caddie.setting('overlap_guard_hours'))::text::int);
      if exists (
        select 1
          from caddie.assignments a
          join caddie.loops l on l.id = a.loop_id
         where a.caddie_id = new.caddie_id
           and a.id <> new.id
           and a.confirmation_status = 'Accepted'
           and l.status <> 'Cancelled'
           and l.tee_time between v_loop.tee_time - v_gap and v_loop.tee_time + v_gap
      ) then
        raise exception 'Caddie already has an accepted loop within % of this tee time', v_gap;
      end if;
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists assignments_guard on caddie.assignments;
create trigger assignments_guard before insert or update on caddie.assignments
  for each row execute function caddie.guard_assignment();

create or replace function caddie.sync_after_assignment()
returns trigger language plpgsql set search_path = caddie, pg_temp as $fn$
begin
  perform caddie.refresh_loop_status(coalesce(new.loop_id, old.loop_id));

  if TG_OP <> 'DELETE'
     and new.confirmation_status = 'Accepted'
     and (TG_OP = 'INSERT' or old.confirmation_status is distinct from 'Accepted') then
    update caddie.caddies
       set last_worked_on = greatest(
             coalesce(last_worked_on, date '1900-01-01'),
             (select (l.tee_time at time zone (caddie.setting('course_timezone') #>> '{}'))::date
                from caddie.loops l where l.id = new.loop_id))
     where id = new.caddie_id;
  end if;

  return null;
end;
$fn$;

drop trigger if exists assignments_sync on caddie.assignments;
create trigger assignments_sync after insert or update or delete on caddie.assignments
  for each row execute function caddie.sync_after_assignment();

-- ---------------------------------------------------------------------------
-- respond_to_offer — the ONLY write path for accept/decline.
--
-- "First to respond gets the loop" is a race: two caddies can reply to a
-- broadcast in the same second, in two separate serverless invocations. This
-- locks the loop row, re-checks capacity, and returns a losing result instead
-- of raising, so the SMS webhook can answer the loser politely.
--
-- Returns: {ok, result|reason, loop_id}
-- ---------------------------------------------------------------------------
create or replace function caddie.respond_to_offer(
  p_assignment_id uuid,
  p_accept        boolean,
  p_channel       text default 'web'
)
returns jsonb language plpgsql set search_path = caddie, pg_temp as $fn$
declare
  v_loop_id  uuid;
  v_asg      caddie.assignments%rowtype;
  v_required int;
  v_accepted int;
begin
  select loop_id into v_loop_id from caddie.assignments where id = p_assignment_id;
  if v_loop_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Lock the loop first, then the assignment. Consistent order, no deadlocks.
  select caddies_required into v_required
    from caddie.loops where id = v_loop_id for update;

  select * into v_asg from caddie.assignments where id = p_assignment_id for update;

  if v_asg.confirmation_status <> 'Pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_responded',
                              'status', v_asg.confirmation_status, 'loop_id', v_loop_id);
  end if;

  if v_asg.offer_expires_at is not null and v_asg.offer_expires_at < now() then
    update caddie.assignments set confirmation_status = 'Expired' where id = p_assignment_id;
    return jsonb_build_object('ok', false, 'reason', 'expired', 'loop_id', v_loop_id);
  end if;

  if not p_accept then
    update caddie.assignments
       set confirmation_status = 'Declined', responded_at = now(), response_channel = p_channel
     where id = p_assignment_id;
    return jsonb_build_object('ok', true, 'result', 'declined', 'loop_id', v_loop_id);
  end if;

  select count(*) into v_accepted
    from caddie.assignments
   where loop_id = v_loop_id and confirmation_status = 'Accepted';

  if v_accepted >= v_required then
    update caddie.assignments
       set confirmation_status = 'Expired', responded_at = now(), response_channel = p_channel
     where id = p_assignment_id;
    return jsonb_build_object('ok', false, 'reason', 'already_filled', 'loop_id', v_loop_id);
  end if;

  update caddie.assignments
     set confirmation_status = 'Accepted', responded_at = now(), response_channel = p_channel
   where id = p_assignment_id;

  return jsonb_build_object('ok', true, 'result', 'accepted', 'loop_id', v_loop_id);
end;
$fn$;

-- Maps an inbound "ACCEPT" text to the offer it must be answering: the most
-- recent still-open offer for that number.
create or replace function caddie.find_pending_offer_by_phone(p_phone text)
returns table (assignment_id uuid, caddie_id uuid, loop_id uuid, tee_time timestamptz)
language sql stable set search_path = caddie, pg_temp as $fn$
  select a.id, a.caddie_id, a.loop_id, l.tee_time
    from caddie.assignments a
    join caddie.caddies c on c.id = a.caddie_id
    join caddie.loops   l on l.id = a.loop_id
   where c.phone = p_phone
     and a.confirmation_status = 'Pending'
     and (a.offer_expires_at is null or a.offer_expires_at > now())
     and l.status not in ('Cancelled', 'Completed')
   order by a.offered_at desc
   limit 1;
$fn$;

-- Housekeeping, for a Vercel cron route.
create or replace function caddie.expire_stale_offers()
returns integer language plpgsql set search_path = caddie, pg_temp as $fn$
declare v_count integer;
begin
  with expired as (
    update caddie.assignments
       set confirmation_status = 'Expired'
     where confirmation_status = 'Pending'
       and offer_expires_at is not null
       and offer_expires_at < now()
    returning loop_id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$fn$;

create or replace function caddie.purge_expired_sessions()
returns integer language plpgsql set search_path = caddie, pg_temp as $fn$
declare v_count integer;
begin
  with gone as (
    delete from caddie.sessions
     where expires_at < now() - interval '7 days'
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Lock to server-only: RLS on, no policies -> only service_role reads.
-- ---------------------------------------------------------------------------
alter table caddie.settings          enable row level security;
alter table caddie.caddies           enable row level security;
alter table caddie.sessions          enable row level security;
alter table caddie.availability      enable row level security;
alter table caddie.loops             enable row level security;
alter table caddie.assignments       enable row level security;
alter table caddie.offer_tokens      enable row level security;
alter table caddie.notification_logs enable row level security;
alter table caddie.inbound_messages  enable row level security;

-- Grants so PostgREST serves the schema for the service_role key.
grant usage on schema caddie to anon, authenticated, service_role;
grant all on all tables    in schema caddie to service_role;
grant all on all sequences in schema caddie to service_role;
grant all on all functions in schema caddie to service_role;
alter default privileges in schema caddie grant all on tables    to service_role;
alter default privileges in schema caddie grant all on sequences to service_role;
alter default privileges in schema caddie grant all on functions to service_role;

-- Nothing here is ever called with the anon key.
revoke all on all functions in schema caddie from anon, authenticated;

-- ---------------------------------------------------------------------------
-- AFTER running: Dashboard -> Settings -> API -> Exposed schemas -> add "caddie"
-- ---------------------------------------------------------------------------
