-- Add the program roster cap to events (Event Planner).
-- Total distinct people (registrant + guests) allowed across the WHOLE event,
-- independent of per-date/per-slot capacity. null = no cap.
-- Run once in the HUB Supabase SQL Editor, in the `events` schema.
alter table events.events add column if not exists roster_limit int;
