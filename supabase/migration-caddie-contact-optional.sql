-- A caddie no longer needs a phone or email to exist on the roster.
--
-- The rule dates from when SMS and email were how caddies would be reached.
-- They are not: a caddie signs in by scanning a QR code and hears about loops
-- by push notification, so a roster entry without contact details still works
-- end to end. Refusing it meant a sheet of first names could not be imported
-- at all.
--
-- Choosing a channel still requires that channel: SMS with no phone, or Email
-- with no address, is a broken setting rather than a missing detail. Only
-- 'Both' — the default, meaning "whatever is on file" — may have nothing yet.
alter table caddie.caddies drop constraint if exists caddies_reachable_chk;

alter table caddie.caddies add constraint caddies_reachable_chk check (
     (preferred_contact_method = 'SMS'   and phone is not null)
  or (preferred_contact_method = 'Email' and email is not null)
  or  preferred_contact_method = 'Both'
);
