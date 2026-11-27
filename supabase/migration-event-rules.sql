-- Sign-up dates for the Event Planner (lib/events/signup-window.ts).
--   rules   { opensAt, closesAt, changesAfterClose } as jsonb; null = none.
--           opensAt / closesAt are ISO timestamps. Outside them an "open"
--           event takes no sign-ups; after closesAt members change or withdraw
--           through the event's contact unless changesAfterClose is true.
-- Run once in the HUB Supabase SQL Editor, in the `events` schema. Safe to run
-- twice. Until it has run, events save without dates (and setting a date says so).
alter table events.events add column if not exists rules jsonb;
