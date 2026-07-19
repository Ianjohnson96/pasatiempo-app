-- ============================================================================
-- Marion Hollins Invitational — load into the HUB project's `mhi` schema.
-- Run ONCE in the HUB Supabase SQL Editor (project whzelknn…), THEN add
-- `mhi` to Settings → API → Exposed schemas. After this, the separate MHI
-- Supabase project (fdggvmosyxbqrpyusycu) can be paused/deleted → you're at
-- 2 projects total (Scheduler + Hub), so nothing re-pauses.
-- Data snapshot: roster-2026-07-11.
-- ============================================================================

create extension if not exists pgcrypto;
create schema if not exists mhi;

-- ---- schema (teams + team_players) --------------------------------------
create table if not exists mhi.teams (
  id                uuid primary key default gen_random_uuid(),
  name              text,          -- optional team name / captain's name
  flight            int,           -- tournament flight: 1, 2, or 3
  horse_race_flight text,          -- 'green1' | 'green2' | 'combo'
  sort              int default 0, -- display order within a flight
  created_at        timestamptz default now()
);
create table if not exists mhi.team_players (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid references mhi.teams(id) on delete cascade,
  name       text not null,
  is_member  boolean default false, -- true = Pasatiempo member, false = guest
  sort       int default 0
);
create index if not exists team_players_team_id_idx on mhi.team_players(team_id);
alter table mhi.teams enable row level security;
alter table mhi.team_players enable row level security;

-- ---- roster data snapshot -----------------------------------------------

alter table mhi.teams add column if not exists team_index numeric;
alter table mhi.team_players add column if not exists index numeric;

delete from mhi.team_players;
delete from mhi.teams;

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Stanley + TBD + TBD + TBD', 1, 16.4, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Stanley, Jennifer', 16.4, 1),
  ('TBD', null, 2),
  ('TBD', null, 3),
  ('TBD', null, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Curtis + Kim + Cornelius + Belliveau', 1, 26.1, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Curtis, Cathy', 14.5, 1),
  ('Kim, Grace', 5.2, 2),
  ('Cornelius, Clare', 0.7, 3),
  ('Belliveau, Kim', 5.7, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Hofmann + Beers + Calciano + TBD', 1, 37.6, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Hofmann, Amy', null, 1),
  ('Beers, Katie', 11.4, 2),
  ('Calciano, Marilyn', 26.2, 3),
  ('TBD', null, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Timan + Bagley + Quezada + Leong', 1, 38.8, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Timan, Juvy', 8.7, 1),
  ('Bagley, Lisa', 4.6, 2),
  ('Quezada, Bea', 21.6, 3),
  ('Leong, Sara', 3.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Medved + Kanda + Kinser + Bellingham', 1, 44.2, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Medved, Janee', 16.1, 1),
  ('Kanda, Jodi', 10, 2),
  ('Kinser, Norma', 19.5, 3),
  ('Bellingham, Jamie', -1.4, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Campbell + Mohr + Farina + Rogers', 1, 50.6, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Campbell, Ann', 15.4, 1),
  ('Mohr, Rhonda', 10.2, 2),
  ('Farina, Sue', 14.5, 3),
  ('Rogers, Risa', 10.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Munoz + Weber + Ferguson + DeLuca', 1, 57.6, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Munoz, Nakisa', 17, 1),
  ('Weber, Lisa', 10.7, 2),
  ('Ferguson, Jennifer', 11.9, 3),
  ('DeLuca, Charity', 18, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Martin + Guttas + Alton + Gaither', 1, 59.6, 8)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Martin, Jami', 13.9, 1),
  ('Guttas, Wanda', 15.5, 2),
  ('Alton, Kim', 4.8, 3),
  ('Gaither, Robin', 25.4, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Chorba + Rogers + Phillipson + Kaysen', 2, 63.4, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Chorba, Emily', 21.8, 1),
  ('Rogers, Gail', 20.7, 2),
  ('Phillipson, Julia', 16, 3),
  ('Kayson, Sarah', 4.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Elliott + Curtis + Baba + Stryker', 2, 63.8, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Elliott, Sue', 21.3, 1),
  ('Curtis, Nancy', 10.1, 2),
  ('Baba, Stacey', 19.4, 3),
  ('Stryker, Sue', 13, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Leung + Espiritu + Phillips + Sasaki', 2, 66, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Leung, Patsy', 18.6, 1),
  ('Espiritu, Maria', 15.8, 2),
  ('Phillips, Kathy', 19.1, 3),
  ('Sasaki, Momoe', 12.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Lai + Wu + Nessen + Feriancek', 2, 66.1, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Lai, Jackie', null, 1),
  ('Wu, Joy', 26.8, 2),
  ('Nessen, Natalie', 25.4, 3),
  ('Feriancek, Lia', 13.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Jonas + Hoffmann + Penner + Arnold', 2, 66.8, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Jonas, Shoshana', 21.3, 1),
  ('Hoffmann, Holly', 13.6, 2),
  ('Penner, Jill', 14.9, 3),
  ('Arnold, Vivian', 17, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Takahashi + Evaristo + Curran + Thompson', 2, 69.7, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Takahashi, Lan', 20.4, 1),
  ('Evaristo, Lia', 17.1, 2),
  ('Curran, Jennifer', 9.9, 3),
  ('Thompson, Karen', 22.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Grohe + Gubanc + Rosales + Mills', 2, 94.5, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Grohe, Annie', 26.9, 1),
  ('Gubanc, Angie', 15.1, 2),
  ('Rosales, Liz', 27.7, 3),
  ('Mills, Christy', 24.8, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Evenson + Keith + Heald + Woods', 2, 120.8, 8)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Evenson, Barbi', 26.9, 1),
  ('Keith, Diana', 26.7, 2),
  ('Heald, Jackie', 30.3, 3),
  ('Woods, Christina', 36.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('McCormack + Paul + Bull + Donnely', 3, 59.8, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('McCormack, Christine', 20.1, 1),
  ('Paul, Barbara', 12.9, 2),
  ('Bull, Mary', 17.7, 3),
  ('Donnely, Dorothy', 9.1, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('McCloskey + Johnson + Nieto + Moser', 3, 76.3, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('McCloskey, Gail', 26.3, 1),
  ('Johnson, Jamie', 15.7, 2),
  ('Nieto, Lorri', 16.4, 3),
  ('Moser, Gail', 17.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Pereyra + Dembski + Sumner + Thiltgen', 3, 83.7, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Pereyra, Cathy', 23.5, 1),
  ('Dembski, Lauren', 23.4, 2),
  ('Sumner, Irma', 23.3, 3),
  ('Thiltgen, Michele', 13.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Nilsen + Fillhardt + Branco + Tokarz', 3, 103.6, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Nilsen, Lynn', 26.5, 1),
  ('Fillhardt, Linda', 27.4, 2),
  ('Branco, Karen', 24, 3),
  ('Tokarz, Annie', 25.7, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Bryson + Boyle + Scurich + Campagna', 3, 117.2, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Bryson, Sharon', 30.3, 1),
  ('Boyle, Noelle', 27.9, 2),
  ('Scurich, Carol', 27.1, 3),
  ('Campagna, Jeannie', 31.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Nicholson + Robbins + Larrick + Roberts', 3, 120.4, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Nicholson, Linda', 24.7, 1),
  ('Robbins, Carol', 30, 2),
  ('Larrick, Catherine', 29, 3),
  ('Roberts, Barb', 36.7, 4)
) as x(name, index, sort);

select f.flight, count(*) as teams from mhi.teams f group by f.flight order by f.flight;

-- ---- grants so the API serves the schema (app uses service_role) --------
grant usage on schema mhi to anon, authenticated, service_role;
grant all on all tables    in schema mhi to service_role;
grant all on all sequences in schema mhi to service_role;
alter default privileges in schema mhi grant all on tables    to service_role;
alter default privileges in schema mhi grant all on sequences to service_role;
