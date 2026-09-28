-- When a job on the open board becomes visible to caddies.
--
-- A posted loop is shown to caddies only once it has been announced. The
-- release time, the visibility horizon and next-up's first refusal all decide
-- WHEN that happens (lib/caddie/release.ts); these columns record that it did.
alter table caddie.loops
  -- When the shop put it on the board. A release never runs before this.
  add column if not exists board_posted_at     timestamptz,
  -- When it opened to everyone. Null means caddies cannot see or claim it yet.
  add column if not exists board_announced_at  timestamptz,
  -- When next-up was given first refusal. It is given once, not repeatedly.
  add column if not exists priority_offered_at timestamptz;

-- First refusal is an offer like any other — it notifies, it can be accepted
-- or declined, and it runs out — but it is kept distinguishable, because the
-- board has to know the job is being held for someone.
alter table caddie.assignments drop constraint if exists assignments_kind_chk;
alter table caddie.assignments add constraint assignments_kind_chk
  check (offer_kind = any (array['direct', 'broadcast', 'priority']));

-- Loops already on the board were public under the old rules. Mark them
-- announced, so nothing silently vanishes from caddies' phones on deploy.
update caddie.loops
   set board_posted_at    = coalesce(board_posted_at, updated_at, created_at),
       board_announced_at = coalesce(board_announced_at, now())
 where open_board;

-- The sweep looks for posted-but-not-yet-open loops every ten minutes.
create index if not exists loops_board_waiting_idx
  on caddie.loops (tee_time)
  where open_board and board_announced_at is null;
