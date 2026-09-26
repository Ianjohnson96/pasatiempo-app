-- Telling apart the four ways a loop stops being someone's.
--
-- "Withdrawn" has always meant the shop pulled the offer. There was no way to
-- record a caddie taking a loop and then handing it back, which is the exact
-- behaviour the shop wants to see — nor a caddie who took it and never turned
-- up, which is worse and belongs in its own category.
--
-- Dropped: the caddie backed out after accepting.
-- No Show: the caddie accepted and did not appear. Staff mark this, never the
--          caddie, so it carries a name.
alter table caddie.assignments
  drop constraint if exists assignments_status_chk;

alter table caddie.assignments
  add constraint assignments_status_chk
  check (confirmation_status = any (array[
    'Pending', 'Accepted', 'Declined', 'Expired', 'Withdrawn',
    'Dropped', 'No Show'
  ]));

alter table caddie.assignments
  -- When the caddie handed it back. Lateness is derived against the loop's tee
  -- time at read time rather than frozen here, so moving a tee time keeps the
  -- record honest.
  add column if not exists dropped_at  timestamptz,
  -- Staff email. A no-show accusation with nobody's name on it is not a record
  -- anyone can defend later.
  add column if not exists marked_by   text,
  -- One tap, so declining costs the caddie nothing and still tells the shop
  -- whether a man is unreliable or simply never offered the right work.
  add column if not exists decline_reason text;

comment on column caddie.assignments.decline_reason is
  'Optional short reason: working, unavailable, wrong loop type, too short notice.';

create index if not exists assignments_caddie_status_idx
  on caddie.assignments (caddie_id, confirmation_status);
