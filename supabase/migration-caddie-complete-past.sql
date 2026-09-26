-- ===========================================================================
-- Close out loops that have already been played.
--
-- Nothing ever marked a loop Completed, so every loop the club has ever run
-- stayed Assigned for ever. Two consequences, one cosmetic and one not:
--
--   * "booked" and "worked" were indistinguishable. With seniority tiers
--     driving dispatch, loops actually worked is the number that settles an
--     argument about who has been passed over.
--
--   * a loop that teed off yesterday still counted as live, so the board
--     would happily offer it — or blast every caddie about it.
--
-- Only loops somebody actually accepted are completed. A loop nobody took is
-- not "complete", it is a job the club failed to cover, and quietly
-- relabelling that would erase the only evidence it happened.
--
-- refresh_loop_status() already refuses to touch Completed rows, so this also
-- freezes history: a caddie withdrawing from last Saturday cannot reopen it.
--
-- Applied to the HUB project as caddie_complete_past.
-- ===========================================================================

create or replace function caddie.complete_past_loops(p_grace_hours integer default 6)
returns integer language plpgsql set search_path = caddie, pg_temp as $fn$
declare v_count integer;
begin
  with done as (
    update caddie.loops l
       set status = 'Completed',
           open_board = false
     where l.status in ('Assigned', 'Partially Assigned')
       and l.tee_time < now() - make_interval(hours => greatest(p_grace_hours, 0))
       and exists (
         select 1
           from caddie.assignments a
          where a.loop_id = l.id
            and a.confirmation_status = 'Accepted'
       )
    returning 1
  )
  select count(*) into v_count from done;
  return v_count;
end;
$fn$;

revoke all on function caddie.complete_past_loops(integer) from anon, authenticated;

-- How long after a tee time a loop counts as played. Long enough that a round
-- in progress is never closed out underneath the caddie working it.
update caddie.settings
   set data = data || jsonb_build_object('complete_after_hours', 6),
       updated_at = now()
 where id = 1;
