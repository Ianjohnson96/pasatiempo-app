-- ===========================================================================
-- Caddie loop types, and a flat rate card.
--
-- Pasatiempo plays 18. The hole count was a dimension on the rate card that
-- never had more than one real value in it, so rates collapse to one figure per
-- loop type — four numbers the Pro Shop can actually keep current, instead of
-- sixteen cells that were mostly noise.
--
-- The loops.holes column stays (default 18, still constrained to 9/18/27/36).
-- Dropping it would be a one-way door for the sake of tidiness, and a 9-hole
-- loop is a plausible thing to want later. It simply leaves the UI.
--
-- Applied to the HUB project as caddie_loop_types.
-- ===========================================================================

-- Carry any existing rows onto the new names before the constraint tightens.
update caddie.loops set loop_type = 'Single Bag'     where loop_type = 'Single Caddie';
update caddie.loops set loop_type = 'Forecaddie 1-2' where loop_type = 'Forecaddie';

alter table caddie.loops drop constraint if exists loops_type_chk;

alter table caddie.loops
  add constraint loops_type_chk check (loop_type in (
    'Single Bag',
    'Double Bag',
    'Forecaddie 1-2',
    'Forecaddie 3-4'
  ));

alter table caddie.loops alter column loop_type set default 'Single Bag';

-- One rate per loop type, in cents, replacing the type -> holes -> cents shape.
-- Seeded at zero again rather than guessed: a wrong number on a caddie's phone
-- is worse than a blank one.
update caddie.settings
   set data = jsonb_set(
         data,
         '{rates}',
         jsonb_build_object(
           'Single Bag',     0,
           'Double Bag',     0,
           'Forecaddie 1-2', 0,
           'Forecaddie 3-4', 0
         )
       ),
       updated_at = now()
 where id = 1;
