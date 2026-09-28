-- Caddie job preferences, and the consent record texting needs.
--
-- Preferences are soft: a caddie who would rather not carry doubles still
-- appears for a double bag, just further down the list, and is not the one
-- handed next-up first refusal on it. The shop can always override.
--
-- Texting consent is the caddie's own. The shop can switch texts off for
-- someone, but only the caddie can switch them on, from their own phone, and
-- the moment and wording they agreed to are kept — a carrier can ask for that
-- record, and "the shop ticked a box" is not consent.
--
-- Applied to the HUB project as caddie_prefs_and_texting.

alter table caddie.caddies
  add column if not exists job_prefs      jsonb not null default '{}'::jsonb,
  add column if not exists sms_opt_in_at  timestamptz,
  add column if not exists sms_consent    text;

comment on column caddie.caddies.job_prefs is
  '{"avoid": [loop types they would rather not take], "note": free text for the shop}';
comment on column caddie.caddies.sms_consent is
  'The exact wording the caddie agreed to when they switched texts on.';

-- Texting settings sit alongside the existing sms_enabled master switch.
update caddie.settings
   set data = data || jsonb_build_object(
     'sms', coalesce(data -> 'sms', jsonb_build_object(
       'offers',    true,   -- offers sent to a caddie by name, tier or next-up
       'reminders', true,   -- "you're on tomorrow"
       'board',     false   -- job-board announcements to everyone opted in
     ))
   )
 where id = 1;
