-- Marion Hollins Invitational — roster replace (flight report 7-22-2026)
-- Run in Supabase SQL Editor against the mhi schema. Idempotent: clears then reloads.

delete from mhi.team_players;
delete from mhi.teams;

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Curtis + Kim + Cornelius + Belliveau', 1, 25.4, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Curtis, Cathy', 14.2, 1),
  ('Kim, Grace', 5.2, 2),
  ('Cornelius, Clare', 0.3, 3),
  ('Belliveau, Kim', 5.7, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Timan + Bagley + Quezada + Leong', 1, 38.9, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Timan, Juvy', 9, 1),
  ('Bagley, Lisa', 4.6, 2),
  ('Quezada, Bea', 21.3, 3),
  ('Leong, Sara', 4, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Medved + Kanda + Kinser + Bellingham', 1, 45.2, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Medved, Janee', 16.1, 1),
  ('Kanda, Jodi', 10.4, 2),
  ('Kinser, Norma', 20, 3),
  ('Bellingham, Jamie', -1.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Campbell + Mohr + Farina + Rogers', 1, 51.7, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Campbell, Ann', 16, 1),
  ('Mohr, Rhonda', 10.2, 2),
  ('Farina, Sue', 14.4, 3),
  ('Rogers, Risa', 11.1, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Munoz + Weber + Ferguson + DeLuca', 1, 57.1, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Munoz, Nakisa', 16.6, 1),
  ('Weber, Lisa', 10.6, 2),
  ('Ferguson, Jennifer', 11.9, 3),
  ('DeLuca, Charity', 18, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Martin + Guttas + Alton + Gaither', 1, 59.5, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Martin, Jami', 14, 1),
  ('Guttas, Wanda', 15.5, 2),
  ('Alton, Kim', 4.6, 3),
  ('Gaither, Robin', 25.4, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('McCormack + Paul + Bull + Donnely', 1, 60.1, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('McCormack, Christine', 20, 1),
  ('Paul, Barbara', 12.9, 2),
  ('Bull, Mary', 17.7, 3),
  ('Donnely, Dorothy', 9.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Chorba + Rogers + Phillipson + Kayson', 2, 62.7, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Chorba, Emily', 21.3, 1),
  ('Rogers, Gail', 20.3, 2),
  ('Phillipson, Julia', 16.2, 3),
  ('Kayson, Sarah', 4.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Leung + Espiritu + Phillips + Sasaki', 2, 65.9, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Leung, Patsy', 18.5, 1),
  ('Espiritu, Maria', 15.8, 2),
  ('Phillips, Kathy', 19.2, 3),
  ('Sasaki, Momoe', 12.4, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Elliott + Curtis + Baba + Butler', 2, 66.1, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Elliott, Sue', 21.3, 1),
  ('Curtis, Nancy', 10.1, 2),
  ('Baba, Stacey', 19.4, 3),
  ('Butler, Jae', 15.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Jonas + Hoffmann + Penner + Arnold', 2, 67.9, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Jonas, Shoshana', 21.7, 1),
  ('Hoffmann, Holly', 13.6, 2),
  ('Penner, Jill', 15, 3),
  ('Arnold, Vivian', 17.6, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Hofmann + Beers + Calciano + McKenna', 2, 70, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Hofmann, Amy', 21.7, 1),
  ('Beers, Katie', 11.4, 2),
  ('Calciano, Marilyn', 26.4, 3),
  ('McKenna, Meghan', 10.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Takahashi + Evaristo + Curran + Thompson', 2, 70.1, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Takahashi, Lan', 21, 1),
  ('Evaristo, Lia', 17.1, 2),
  ('Curran, Jennifer', 9.7, 3),
  ('Thompson, Karen', 22.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('McCloskey + Johnson + Nieto + Moser', 2, 74.6, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('McCloskey, Gail', 26, 1),
  ('Johnson, Jamie', 15.9, 2),
  ('Nieto, Lorri', 15.2, 3),
  ('Moser, Gail', 17.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Pereyra + Dembski + Sumner + Thiltgen', 3, 83, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Pereyra, Cathy', 23, 1),
  ('Dembski, Lauren', 23.4, 2),
  ('Sumner, Irma', 23.3, 3),
  ('Thiltgen, Michele', 13.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Lai + Wu + Nessen + Feriancek', 3, 85.6, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Lai, Jackie', 21.9, 1),
  ('Wu, Joy', 25.1, 2),
  ('Nessen, Natalie', 25.3, 3),
  ('Feriancek, Lia', 13.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Stanley + Beecher + Thomason + Pacheco', 3, 92.4, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Stanley, Jennifer', 16.4, 1),
  ('Beecher, Julie', 22.7, 2),
  ('Thomason, Kathy', 28, 3),
  ('Pacheco, Stacy', 25.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Grohe + Gubanc + Rosales + Mills', 3, 94.8, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Grohe, Annie', 26.9, 1),
  ('Gubanc, Angie', 15.8, 2),
  ('Rosales, Liz', 27.6, 3),
  ('Mills, Christy', 24.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Nilsen + Fillhardt + Branco + Tokarz', 3, 103.6, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Nilsen, Lynn', 26.6, 1),
  ('Fillhardt, Linda', 27.1, 2),
  ('Branco, Karen', 24.2, 3),
  ('Tokarz, Annie', 25.7, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Bryson + Boyle + Scurich + Campagna', 3, 116.7, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Bryson, Sharon', 30.3, 1),
  ('Boyle, Noelle', 27.3, 2),
  ('Scurich, Carol', 27.1, 3),
  ('Campagna, Jeannie', 32, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Nicholson + Robbins + Larrick + Roberts', 3, 120.5, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Nicholson, Linda', 25.1, 1),
  ('Robbins, Carol', 30, 2),
  ('Larrick, Catherine', 28.7, 3),
  ('Roberts, Barb', 36.7, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Evenson + Keith + Heald + Woods', 3, 120.6, 8)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Evenson, Barbi', 26.7, 1),
  ('Keith, Diana', 26.7, 2),
  ('Heald, Jackie', 30.3, 3),
  ('Woods, Christina', 36.9, 4)
) as x(name, index, sort);

-- sanity check
select flight, count(*) as teams from mhi.teams group by flight order by flight;
