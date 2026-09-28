-- Handing a loop back must not count as having worked it.
--
-- Accepting a loop stamps the caddie's last_worked_on with that loop's date,
-- and the dispatch list ranks caddies by how long since they last worked. When
-- a caddie dropped the loop the stamp stayed, so he looked as though he had
-- just worked and slid down the order — for a loop he never did. Now, whenever
-- an accepted assignment stops being accepted (dropped, withdrawn, deleted),
-- last_worked_on is recomputed from the loops he still holds, ignoring any that
-- were cancelled.
create or replace function caddie.sync_after_assignment()
  returns trigger
  language plpgsql
  set search_path = caddie, pg_temp
as $$
begin
  perform caddie.refresh_loop_status(coalesce(new.loop_id, old.loop_id));

  if TG_OP <> 'DELETE'
     and new.confirmation_status = 'Accepted'
     and (TG_OP = 'INSERT' or old.confirmation_status is distinct from 'Accepted') then
    update caddie.caddies
       set last_worked_on = greatest(
             coalesce(last_worked_on, date '1900-01-01'),
             (select (l.tee_time at time zone (caddie.setting('course_timezone') #>> '{}'))::date
                from caddie.loops l where l.id = new.loop_id))
     where id = new.caddie_id;
  end if;

  if TG_OP <> 'INSERT'
     and old.confirmation_status = 'Accepted'
     and (TG_OP = 'DELETE' or new.confirmation_status is distinct from 'Accepted') then
    update caddie.caddies c
       set last_worked_on = (
             select max((l.tee_time at time zone (caddie.setting('course_timezone') #>> '{}'))::date)
               from caddie.assignments a
               join caddie.loops l on l.id = a.loop_id
              where a.caddie_id = old.caddie_id
                and a.confirmation_status = 'Accepted'
                and l.status <> 'Cancelled')
     where c.id = old.caddie_id;
  end if;

  return null;
end;
$$;
