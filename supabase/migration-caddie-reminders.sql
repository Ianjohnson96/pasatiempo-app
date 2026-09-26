-- ===========================================================================
-- Reminders for loops a caddie has already accepted.
--
-- reminder_hours_before has sat in settings since the schema was written and
-- nothing ever read it. A caddie who accepted a Saturday loop on Tuesday hears
-- nothing until Saturday, which in an on-call programme is the main way a
-- no-show happens: not refusal, just forgetting.
--
-- One column rather than a lookup against notification_logs, because "has this
-- assignment been reminded" is a fact about the assignment and wants to be
-- cheap and unique per row — the sweep must never double-send.
--
-- Applied to the HUB project as caddie_reminders.
-- ===========================================================================

alter table caddie.assignments
  add column if not exists reminder_sent_at timestamptz;

-- The sweep looks for accepted work with no reminder yet, so index exactly
-- that: a partial index stays small however much history accumulates.
create index if not exists assignments_reminder_due_idx
  on caddie.assignments (confirmation_status)
  where reminder_sent_at is null;

-- Widened from 12 to 24 hours.
--
-- Vercel's Hobby plan allows one cron a day, so a literal 12-hour reminder
-- cannot be delivered on time — the job would simply miss most loops. A
-- 24-hour window run in the early evening reminds a caddie about everything
-- they are on for tomorrow, which is the message that actually prevents a
-- no-show. On a plan that allows hourly crons, drop this back to 12 and the
-- same sweep gives a true twelve-hour reminder with no code change.
update caddie.settings
   set data = data || jsonb_build_object('reminder_hours_before', 24),
       updated_at = now()
 where id = 1;
