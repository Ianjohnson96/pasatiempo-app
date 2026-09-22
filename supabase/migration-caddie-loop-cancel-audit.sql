-- Who called this off, and when.
--
-- A loop that vanishes from the sheet is an argument waiting to happen: the
-- caddie who was on it wants to know who cancelled and when, and "the system
-- did" is not an answer. Posting was already attributed (created_by,
-- created_at); cancelling was not.
alter table caddie.loops
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text;

comment on column caddie.loops.cancelled_by is
  'Staff email that cancelled the loop. Null on loops cancelled before this column existed.';
