-- Marion Hollins Invitational — FINAL handicap update
-- Same 22 teams/composition as the 7-22 report; indexes updated to final values.
-- Run in Supabase SQL Editor against the mhi schema. Idempotent: clears then reloads.

delete from mhi.team_players;
delete from mhi.teams;

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Curtis + Kim + Cornelius + Belliveau', 1, 25.7, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Curtis, Cathy', 14.2, 1),
  ('Kim, Grace', 5.1, 2),
  ('Cornelius, Clare', 0.3, 3),
  ('Belliveau, Kim', 6.1, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Timan + Bagley + Quezada + Leong', 1, 38.4, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Timan, Juvy', 8.8, 1),
  ('Bagley, Lisa', 4.3, 2),
  ('Quezada, Bea', 21.3, 3),
  ('Leong, Sara', 4, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Medved + Kanda + Kinser + Bellingham', 1, 45.3, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Medved, Janee', 16.1, 1),
  ('Kanda, Jodi', 10.3, 2),
  ('Kinser, Norma', 20.2, 3),
  ('Bellingham, Jamie', -1.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Campbell + Mohr + Farina + Rogers', 1, 52.3, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Campbell, Ann', 16, 1),
  ('Mohr, Rhonda', 10.7, 2),
  ('Farina, Sue', 14.8, 3),
  ('Rogers, Risa', 10.8, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Munoz + Weber + Ferguson + DeLuca', 1, 56.1, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Munoz, Nakisa', 16.1, 1),
  ('Weber, Lisa', 9.7, 2),
  ('Ferguson, Jennifer', 12.3, 3),
  ('DeLuca, Charity', 18, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Martin + Guttas + Alton + Gaither', 1, 58.2, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Martin, Jami', 13.2, 1),
  ('Guttas, Wanda', 15.4, 2),
  ('Alton, Kim', 4.6, 3),
  ('Gaither, Robin', 25, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('McCormack + Paul + Bull + Donnely', 1, 59, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('McCormack, Christine', 20.2, 1),
  ('Paul, Barbara', 12.1, 2),
  ('Bull, Mary', 17.7, 3),
  ('Donnely, Dorothy', 9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Chorba + Rogers + Phillipson + Kayson', 2, 63.5, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Chorba, Emily', 21.7, 1),
  ('Rogers, Gail', 20.6, 2),
  ('Phillipson, Julia', 16.2, 3),
  ('Kayson, Sarah', 5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Leung + Espiritu + Phillips + Sasaki', 2, 67.1, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Leung, Patsy', 18.2, 1),
  ('Espiritu, Maria', 15.8, 2),
  ('Phillips, Kathy', 19.1, 3),
  ('Sasaki, Momoe', 14, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Elliott + Curtis + Baba + Butler', 2, 65.6, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Elliott, Sue', 21.2, 1),
  ('Curtis, Nancy', 9.5, 2),
  ('Baba, Stacey', 19, 3),
  ('Butler, Jae', 15.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Jonas + Hoffmann + Penner + Arnold', 2, 69.2, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Jonas, Shoshana', 22.6, 1),
  ('Hoffmann, Holly', 13.6, 2),
  ('Penner, Jill', 15.4, 3),
  ('Arnold, Vivian', 17.6, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Hofmann + Beers + Calciano + McKenna', 2, 70.2, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Hofmann, Amy', 21.9, 1),
  ('Beers, Katie', 11.2, 2),
  ('Calciano, Marilyn', 26.4, 3),
  ('McKenna, Meghan', 10.7, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Takahashi + Evaristo + Curran + Thompson', 2, 69.8, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Takahashi, Lan', 20.9, 1),
  ('Evaristo, Lia', 17.1, 2),
  ('Curran, Jennifer', 9.2, 3),
  ('Thompson, Karen', 22.6, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('McCloskey + Johnson + Nieto + Moser', 2, 73.2, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('McCloskey, Gail', 25.9, 1),
  ('Johnson, Jamie', 15.9, 2),
  ('Nieto, Lorri', 13.9, 3),
  ('Moser, Gail', 17.5, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Pereyra + Dembski + Sumner + Thiltgen', 3, 82.4, 1)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Pereyra, Cathy', 22.5, 1),
  ('Dembski, Lauren', 23.3, 2),
  ('Sumner, Irma', 23.3, 3),
  ('Thiltgen, Michele', 13.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Lai + Wu + Nessen + Feriancek', 3, 84.1, 2)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Lai, Jackie', 21.4, 1),
  ('Wu, Joy', 25.1, 2),
  ('Nessen, Natalie', 24.7, 3),
  ('Feriancek, Lia', 12.9, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Stanley + Beecher + Thomason + Pacheco', 3, 93.1, 3)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Stanley, Jennifer', 16.9, 1),
  ('Beecher, Julie', 22.7, 2),
  ('Thomason, Kathy', 28.1, 3),
  ('Pacheco, Stacy', 25.4, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Grohe + Gubanc + Rosales + Mills', 3, 94.5, 4)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Grohe, Annie', 26.9, 1),
  ('Gubanc, Angie', 15.9, 2),
  ('Rosales, Liz', 27.6, 3),
  ('Mills, Christy', 24.1, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Nilsen + Fillhardt + Branco + Tokarz', 3, 104.9, 5)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Nilsen, Lynn', 27.6, 1),
  ('Fillhardt, Linda', 27.2, 2),
  ('Branco, Karen', 23.8, 3),
  ('Tokarz, Annie', 26.3, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Bryson + Boyle + Scurich + Campagna', 3, 115.1, 6)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Bryson, Sharon', 29.1, 1),
  ('Boyle, Noelle', 26.9, 2),
  ('Scurich, Carol', 27.1, 3),
  ('Campagna, Jeannie', 32, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Nicholson + Robbins + Larrick + Roberts', 3, 121, 7)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Nicholson, Linda', 25.1, 1),
  ('Robbins, Carol', 29.8, 2),
  ('Larrick, Catherine', 29.3, 3),
  ('Roberts, Barb', 36.8, 4)
) as x(name, index, sort);

with t as (
  insert into mhi.teams (name, flight, team_index, sort)
  values ('Evenson + Keith + Heald + Woods', 3, 120.3, 8)
  returning id
)
insert into mhi.team_players (team_id, name, index, is_member, sort)
select t.id, x.name, x.index, true, x.sort from t, (values
  ('Evenson, Barbi', 26.4, 1),
  ('Keith, Diana', 26.7, 2),
  ('Heald, Jackie', 30.3, 3),
  ('Woods, Christina', 36.9, 4)
) as x(name, index, sort);

-- sanity check
select flight, count(*) as teams from mhi.teams group by flight order by flight;
