-- ============================================================================
-- Merchandise Program: month-end data loads all at once, with an undo.
-- /merch/api/import loads a data file through merch.put_docs, which writes
-- every document in one transaction (all or nothing) and keeps what each one
-- held before in merch.imports. Month-end -> Undo last update calls
-- merch.undo_import, which puts the latest load's documents back. Run ONCE in
-- the hub project, after migration-merch-schema.sql.
-- ============================================================================

create table if not exists merch.imports (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  by_email   text,
  note       text,
  paths      int not null,
  prior      jsonb not null,          -- {path: data before the load, or null where there was none}
  undone_at  timestamptz,
  undone_by  text
);
alter table merch.imports enable row level security;

-- Write every document in p_docs ({path: data}) as one transaction and return
-- the load's id. Only the last 12 loads are kept for undo.
create or replace function merch.put_docs(p_docs jsonb, p_by text, p_note text default null)
returns bigint
language plpgsql
as $$
declare
  k text;
  v jsonb;
  before jsonb := '{}'::jsonb;
  n int := 0;
  new_id bigint;
begin
  if jsonb_typeof(p_docs) <> 'object' then
    raise exception 'put_docs: p_docs must be an object';
  end if;
  for k in select jsonb_object_keys(p_docs) loop
    before := before || jsonb_build_object(k, (select d.data from merch.docs d where d.path = k and not d.deleted));
    n := n + 1;
  end loop;
  insert into merch.imports (by_email, note, paths, prior) values (p_by, p_note, n, before) returning id into new_id;
  for k, v in select * from jsonb_each(p_docs) loop
    perform merch.put_doc(k, v, p_by, null);
  end loop;
  delete from merch.imports where id not in (select id from merch.imports order by id desc limit 12);
  return new_id;
end;
$$;

-- Put back what the latest load (not already undone) replaced. Documents it
-- created are deleted. Returns the number of documents restored; raises if
-- p_id isn't the latest load.
create or replace function merch.undo_import(p_id bigint, p_by text)
returns int
language plpgsql
as $$
declare
  rec merch.imports%rowtype;
  k text;
  v jsonb;
  n int := 0;
begin
  select * into rec from merch.imports where undone_at is null order by id desc limit 1 for update;
  if not found or rec.id <> p_id then
    raise exception 'undo_import: % is not the latest load', p_id;
  end if;
  for k, v in select * from jsonb_each(rec.prior) loop
    perform merch.put_doc(k, case when jsonb_typeof(v) = 'null' then null else v end, p_by, null);
    n := n + 1;
  end loop;
  update merch.imports set undone_at = now(), undone_by = p_by where id = rec.id;
  return n;
end;
$$;

grant all on merch.imports to service_role;
revoke all on function merch.put_docs(jsonb, text, text) from public, anon, authenticated;
revoke all on function merch.undo_import(bigint, text) from public, anon, authenticated;
grant execute on function merch.put_docs(jsonb, text, text) to service_role;
grant execute on function merch.undo_import(bigint, text) to service_role;
