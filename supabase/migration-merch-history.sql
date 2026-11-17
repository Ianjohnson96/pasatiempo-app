-- ============================================================================
-- Merchandise Program: a history of hand-entered records.
-- Every time an order, vendor, count, checklist, budget change, brand call or
-- assignment is changed or deleted, what it held before is kept in
-- merch.doc_history, with who changed it and when. A deleted order can then be
-- found and put back. Month-end data (base, skuhist, …) isn't kept here: it has
-- its own undo (merch.imports). History older than 400 days is cleared as new
-- history is written. Run ONCE in the hub project, after migration-merch-schema.sql.
--
-- To find a deleted order:
--   select at, by_email, data from merch.doc_history
--    where path like 'pos/%' and data->>'poNumber' = '…' order by at desc;
-- ============================================================================

create table if not exists merch.doc_history (
  id        bigint generated always as identity primary key,
  path      text not null,
  version   int not null,
  data      jsonb,                       -- what the record held before this change
  by_email  text,                        -- who made the change
  at        timestamptz not null default now(),
  action    text not null check (action in ('update', 'delete'))
);
create index if not exists doc_history_path_idx on merch.doc_history (path, at desc);
create index if not exists doc_history_at_idx on merch.doc_history (at);
alter table merch.doc_history enable row level security;

create or replace function merch.keep_doc_history()
returns trigger
language plpgsql
as $$
begin
  if split_part(old.path, '/', 1) not in ('pos', 'vendors', 'subcats', 'counts', 'istate', 'checklist', 'plan',
                                          'brandCalls', 'brandmap', 'submap') then
    return new;
  end if;
  if old.deleted or old.data is null or old.data = new.data then
    return new;
  end if;
  insert into merch.doc_history (path, version, data, by_email, action)
  values (old.path, old.version, old.data, new.updated_by, case when new.deleted then 'delete' else 'update' end);
  -- keep it from growing without end: about once in 200 writes, clear history older than 400 days
  if random() < 0.005 then
    delete from merch.doc_history where at < now() - interval '400 days';
  end if;
  return new;
end;
$$;

drop trigger if exists docs_keep_history on merch.docs;
create trigger docs_keep_history
  before update on merch.docs
  for each row execute function merch.keep_doc_history();

grant all on merch.doc_history to service_role;
