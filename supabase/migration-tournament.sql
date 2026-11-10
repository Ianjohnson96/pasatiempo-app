-- Tournament events (Event Planner): two-player Member + Guest teams.
-- players holds the two players of a team (role, name, email, GHIN, per-player answers);
-- email_failed flags a registration whose confirmation email could not be sent.
-- Run once in the HUB Supabase SQL Editor, in the `events` schema.
alter table events.registrations add column if not exists players jsonb;
alter table events.registrations add column if not exists email_failed boolean not null default false;
