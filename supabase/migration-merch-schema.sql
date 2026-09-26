-- ============================================================================
-- Pro Shop Merchandise Program — `merch` schema in the HUB project.
-- Run ONCE in the HUB Supabase SQL Editor (project whzelknn…), THEN add
-- `merch` to Settings → API → Exposed schemas.
--
-- The program keeps its data as JSON documents addressed by path, the same
-- shape it used as a claude.ai artifact (pos/{id}, vendors/{id}, base/current,
-- plan/fy27/adjustments/{id}, …). Deletes leave a tombstone so browsers that
-- poll for changes (by `rev`) see them. Access rules live in the app
-- (lib/merch/rules.ts); only the service_role touches these tables.
-- ============================================================================

create schema if not exists merch;

-- ---- people who can open the program -----------------------------------
-- owner  : everything, including forecast, budgets, brand calls, month-end data
-- staff  : orders, receipts, vendors, subcategories, counts, to-do states, checklist
-- viewer : read only
create table if not exists merch.members (
  email       text primary key check (email = lower(email)),
  name        text not null default '',
  role        text not null check (role in ('owner', 'staff', 'viewer')),
  active      boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);
alter table merch.members enable row level security;

-- ---- documents ----------------------------------------------------------
create sequence if not exists merch.rev_seq;
create table if not exists merch.docs (
  path        text primary key check (path ~ '^[A-Za-z0-9_.~:@+-]+(/[A-Za-z0-9_.~:@+-]+)*$'),
  data        jsonb,                          -- null when deleted
  deleted     boolean not null default false,
  version     int not null default 1,
  rev         bigint not null default nextval('merch.rev_seq'),
  updated_by  text,
  updated_at  timestamptz not null default now()
);
create index if not exists docs_rev_idx on merch.docs (rev);
alter table merch.docs enable row level security;

-- Write (p_data not null) or delete (p_data null) one document, bumping its
-- version and giving it a fresh rev. With p_if_version, the write applies only
-- if the stored version still matches; otherwise nothing changes and no row
-- comes back.
create or replace function merch.put_doc(p_path text, p_data jsonb, p_by text, p_if_version int default null)
returns setof merch.docs
language plpgsql
as $$
begin
  if p_if_version is not null then
    return query
      update merch.docs d
         set data = p_data, deleted = p_data is null, version = d.version + 1,
             rev = nextval('merch.rev_seq'), updated_by = p_by, updated_at = now()
       where d.path = p_path and d.version = p_if_version
      returning d.*;
    return;
  end if;
  return query
    insert into merch.docs as d (path, data, deleted, updated_by)
    values (p_path, p_data, p_data is null, p_by)
    on conflict (path) do update
       set data = excluded.data, deleted = excluded.deleted, version = d.version + 1,
           rev = nextval('merch.rev_seq'), updated_by = excluded.updated_by, updated_at = now()
    returning d.*;
end;
$$;

-- ---- grants so the API serves the schema (app uses service_role) --------
grant usage on schema merch to anon, authenticated, service_role;
grant all on all tables    in schema merch to service_role;
grant all on all sequences in schema merch to service_role;
revoke all on function merch.put_doc(text, jsonb, text, int) from public, anon, authenticated;
grant execute on function merch.put_doc(text, jsonb, text, int) to service_role;
alter default privileges in schema merch grant all on tables    to service_role;
alter default privileges in schema merch grant all on sequences to service_role;

-- ---- the owner ----------------------------------------------------------
insert into merch.members (email, name, role, created_by)
values ('ijohnson@pasatiempo.com', 'Ian Johnson', 'owner', 'migration')
on conflict (email) do nothing;
