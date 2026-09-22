-- Invites: reusable for an hour, instead of single-use for a week.
--
-- A QR scanned with a phone camera often opens in that app's own browser,
-- which keeps its own cookies. The caddie's one scan therefore signed them in
-- inside a throwaway window, burned the link, and left them locked out of the
-- browser they actually use — with the portal telling them only that the link
-- was "already used". Every caddie onboarded this way would have hit it.
--
-- Reuse costs little: the link names one caddie, so a second claim only ever
-- mints another session for that same person. Shrinking the life from seven
-- days to one hour more than pays for it — the shop shows the QR with the
-- caddie standing at the counter, so an hour is already generous.

update caddie.settings
   set data = (data - 'invite_days')
              || jsonb_build_object('invite_minutes', 60)
 where id = 1;

-- Links minted under the old rules carry a seven-day expiry, and the change
-- above would have made those reusable for the rest of the week. Retire them;
-- the shop mints fresh ones on demand.
update caddie.invites
   set expires_at = now()
 where expires_at > now() + interval '2 hours';
