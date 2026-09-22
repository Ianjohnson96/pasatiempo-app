-- A week, not an hour.
--
-- Sixty minutes suited a QR shown on the counter screen with the caddie
-- standing there. It does not suit the printed handout this app actually
-- produces — paper carrying a link that dies before the caddie gets home is
-- worse than no paper. Reuse, not brevity, was what fixed the real problem: a
-- camera app opening the link in its own browser and stranding the caddie.
--
-- The exposure stays small either way. The link names one caddie, so anyone
-- who scans it gets a session as that person and nothing else — no other
-- caddie's details, and no route into the admin side at all.
update caddie.settings
   set data = data || jsonb_build_object('invite_minutes', 10080)
 where id = 1;
