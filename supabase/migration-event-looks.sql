-- Per-event looks for the Event Planner's public sign-up page.
--   theme          the page's look: { preset, accent, heroPhoto, heroFocus, logo }.
--                  null = Clubhouse (the planner's own ivory / club green / brass).
--   contact_name   who members should contact about this event;
--   contact_email  null = the planner's default contact.
-- Run once in the HUB Supabase SQL Editor, in the `events` schema, BEFORE the
-- code that writes these columns is deployed. Safe to run twice.
alter table events.events add column if not exists theme jsonb;
alter table events.events add column if not exists contact_name text;
alter table events.events add column if not exists contact_email text;
