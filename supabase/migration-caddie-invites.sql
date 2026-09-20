-- ===========================================================================
-- Caddie sign-in invites.
--
-- There is no email and no SMS in this app, so a caddie cannot be sent a link.
-- Instead the Pro Shop generates one from the roster and shows it as a QR code
-- on the counter screen; the caddie scans it once and keeps a 90-day cookie.
--
-- An invite is single-use and short-lived. Only the sha256 of the token in the
-- URL is stored, so a database leak cannot be replayed as a sign-in — the same
-- rule caddie.sessions and caddie.offer_tokens already follow.
--
-- Applied to the HUB project as caddie_invites.
-- ===========================================================================

create table if not exists caddie.invites (
  token_hash text primary key,
  caddie_id  uuid not null references caddie.caddies(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_by text,                 -- admin email who handed it over
  created_at timestamptz not null default now()
);

create index if not exists invites_caddie_idx on caddie.invites (caddie_id);
create index if not exists invites_expiry_idx on caddie.invites (expires_at);

alter table caddie.invites enable row level security;

grant all on caddie.invites to service_role;

-- How long a handed-over link stays good. Short, because it is given in person.
update caddie.settings
   set data = data || jsonb_build_object('invite_days', 7),
       updated_at = now()
 where id = 1;

-- Housekeeping alongside purge_expired_sessions().
create or replace function caddie.purge_expired_invites()
returns integer language plpgsql set search_path = caddie, pg_temp as $fn$
declare v_count integer;
begin
  with gone as (
    delete from caddie.invites
     where expires_at < now() - interval '7 days'
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$fn$;

revoke all on function caddie.purge_expired_invites() from anon, authenticated;
