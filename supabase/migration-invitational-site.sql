-- ============================================================================
-- Men's Club Invitational — add it to the public-site switches (hub.sites).
-- Run ONCE in the HUB Supabase SQL Editor, after migration-hub-access.sql.
--
-- Until this runs the page still works (a site with no row counts as on), but
-- the super admin's on/off switch on the dashboard has nothing to flip.
-- ============================================================================

alter table hub.sites drop constraint if exists sites_key_check;
alter table hub.sites add constraint sites_key_check
  check (key in ('events', 'mhi', 'sombrero', 'invitational'));

insert into hub.sites (key, label) values
  ('invitational', 'Men''s Club Invitational')
on conflict (key) do nothing;
