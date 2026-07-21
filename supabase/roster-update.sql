-- ============================================================================
-- Marion Hollins Invitational — full roster (teams + players) for the mhi schema.
-- Generated from the live hub DB; reflects the WC report + member/guest flags
-- (Pasatiempo affiliation = member). Transactional full replace — safe to re-run.
-- ============================================================================
begin;
delete from mhi.teams;  -- cascades to mhi.team_players

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('0dc1fc7b-de09-4838-a19d-b3f55f43d98f', 'Curtis + Kim + Cornelius + Belliveau', 1, 'green1', 25.4, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('0dc1fc7b-de09-4838-a19d-b3f55f43d98f', 'Curtis, Cathy', 14.2, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('0dc1fc7b-de09-4838-a19d-b3f55f43d98f', 'Kim, Grace', 5.2, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('0dc1fc7b-de09-4838-a19d-b3f55f43d98f', 'Cornelius, Clare', 0.3, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('0dc1fc7b-de09-4838-a19d-b3f55f43d98f', 'Belliveau, Kim', 5.7, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('b0eb6185-a9de-4fe8-8a0c-cf1a9b6064c3', 'Hofmann + Beers + Calciano + McKenna', 1, 'green1', 70, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('b0eb6185-a9de-4fe8-8a0c-cf1a9b6064c3', 'Hofmann, Amy', 21.7, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('b0eb6185-a9de-4fe8-8a0c-cf1a9b6064c3', 'Beers, Katie', 11.4, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('b0eb6185-a9de-4fe8-8a0c-cf1a9b6064c3', 'Calciano, Marilyn', 26.4, true, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('b0eb6185-a9de-4fe8-8a0c-cf1a9b6064c3', 'McKenna, Meghan', 10.5, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('51b84be1-56b4-43ed-a69e-2fa2c4fa0b9c', 'Timan + Bagley + Quezada + Leong', 1, 'green1', 38.9, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('51b84be1-56b4-43ed-a69e-2fa2c4fa0b9c', 'Timan, Juvy', 9, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('51b84be1-56b4-43ed-a69e-2fa2c4fa0b9c', 'Bagley, Lisa', 4.6, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('51b84be1-56b4-43ed-a69e-2fa2c4fa0b9c', 'Quezada, Bea', 21.3, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('51b84be1-56b4-43ed-a69e-2fa2c4fa0b9c', 'Leong, Sara', 4, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('8ad30255-444e-4622-85bb-da11e2fd2bf3', 'Medved + Kanda + Kinser + Bellingham', 1, 'green1', 45.2, 4);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('8ad30255-444e-4622-85bb-da11e2fd2bf3', 'Medved, Janee', 16.1, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('8ad30255-444e-4622-85bb-da11e2fd2bf3', 'Kanda, Jodi', 10.4, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('8ad30255-444e-4622-85bb-da11e2fd2bf3', 'Kinser, Norma', 20, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('8ad30255-444e-4622-85bb-da11e2fd2bf3', 'Bellingham, Jamie', -1.3, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('aa99b92c-c777-4f9c-aa6f-2e79ed195bbd', 'Campbell + Mohr + Farina + Rogers', 1, 'green1', 51.7, 5);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aa99b92c-c777-4f9c-aa6f-2e79ed195bbd', 'Campbell, Ann', 16, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aa99b92c-c777-4f9c-aa6f-2e79ed195bbd', 'Mohr, Rhonda', 10.2, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aa99b92c-c777-4f9c-aa6f-2e79ed195bbd', 'Farina, Sue', 14.4, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aa99b92c-c777-4f9c-aa6f-2e79ed195bbd', 'Rogers, Risa', 11.1, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('6df898b6-b53a-401f-863f-18acbe12371e', 'Munoz + Weber + Ferguson + DeLuca', 1, 'green1', 57.1, 6);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6df898b6-b53a-401f-863f-18acbe12371e', 'Munoz, Nakisa', 16.6, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6df898b6-b53a-401f-863f-18acbe12371e', 'Weber, Lisa', 10.6, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6df898b6-b53a-401f-863f-18acbe12371e', 'Ferguson, Jennifer', 11.9, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6df898b6-b53a-401f-863f-18acbe12371e', 'DeLuca, Charity', 18, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('cfec889a-8bed-4452-b716-558b04618035', 'Martin + Guttas + Alton + Gaither', 1, 'green1', 59.5, 7);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('cfec889a-8bed-4452-b716-558b04618035', 'Martin, Jami', 14, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('cfec889a-8bed-4452-b716-558b04618035', 'Guttas, Wanda', 15.5, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('cfec889a-8bed-4452-b716-558b04618035', 'Alton, Kim', 4.6, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('cfec889a-8bed-4452-b716-558b04618035', 'Gaither, Robin', 25.4, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('aef52bfd-415a-41d5-b52f-89805afae5e7', 'McCormack + Paul + Bull + Donnely', 1, 'green1', 60.1, 8);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aef52bfd-415a-41d5-b52f-89805afae5e7', 'McCormack, Christine', 20, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aef52bfd-415a-41d5-b52f-89805afae5e7', 'Paul, Barbara', 12.9, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aef52bfd-415a-41d5-b52f-89805afae5e7', 'Bull, Mary', 17.7, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('aef52bfd-415a-41d5-b52f-89805afae5e7', 'Donnely, Dorothy', 9.5, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('70d8d22a-ec62-4190-a3a0-c1ead1fc378d', 'Chorba + Rogers + Phillipson + Kaysen', 2, 'green2', 62.7, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('70d8d22a-ec62-4190-a3a0-c1ead1fc378d', 'Chorba, Emily', 21.3, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('70d8d22a-ec62-4190-a3a0-c1ead1fc378d', 'Rogers, Gail', 20.3, true, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('70d8d22a-ec62-4190-a3a0-c1ead1fc378d', 'Phillipson, Julia', 16.2, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('70d8d22a-ec62-4190-a3a0-c1ead1fc378d', 'Kaysen, Sarah', 4.9, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('54d5f9a0-e406-45d9-ba31-6d7cc1ca052d', 'Leung + Espiritu + Phillips + Sasaki', 2, 'green2', 65.9, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('54d5f9a0-e406-45d9-ba31-6d7cc1ca052d', 'Leung, Patsy', 18.5, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('54d5f9a0-e406-45d9-ba31-6d7cc1ca052d', 'Espiritu, Maria', 15.8, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('54d5f9a0-e406-45d9-ba31-6d7cc1ca052d', 'Phillips, Kathy', 19.2, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('54d5f9a0-e406-45d9-ba31-6d7cc1ca052d', 'Sasaki, Momoe', 12.4, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('39222cfc-839b-471a-8a58-57b2f088aa23', 'Elliott + Curtis + Baba + Butler', 2, 'green2', 66.1, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('39222cfc-839b-471a-8a58-57b2f088aa23', 'Elliott, Sue', 21.3, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('39222cfc-839b-471a-8a58-57b2f088aa23', 'Curtis, Nancy', 10.1, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('39222cfc-839b-471a-8a58-57b2f088aa23', 'Baba, Stacey', 19.4, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('39222cfc-839b-471a-8a58-57b2f088aa23', 'Butler, Jae', 15.3, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('f93e9ee2-2e33-45ab-a6a2-62c795d2951b', 'Jonas + Hoffmann + Penner + Arnold', 2, 'green2', 67.9, 4);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('f93e9ee2-2e33-45ab-a6a2-62c795d2951b', 'Jonas, Shoshana', 21.7, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('f93e9ee2-2e33-45ab-a6a2-62c795d2951b', 'Hoffmann, Holly', 13.6, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('f93e9ee2-2e33-45ab-a6a2-62c795d2951b', 'Penner, Jill', 15, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('f93e9ee2-2e33-45ab-a6a2-62c795d2951b', 'Arnold, Vivian', 17.6, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('4b51e2a4-c321-4ce2-840a-6cf9dfad18f2', 'Takahashi + Evaristo + Curran + Thompson', 2, 'green2', 70.1, 5);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('4b51e2a4-c321-4ce2-840a-6cf9dfad18f2', 'Takahashi, Lan', 21, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('4b51e2a4-c321-4ce2-840a-6cf9dfad18f2', 'Evaristo, Lia', 17.1, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('4b51e2a4-c321-4ce2-840a-6cf9dfad18f2', 'Curran, Jennifer', 9.7, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('4b51e2a4-c321-4ce2-840a-6cf9dfad18f2', 'Thompson, Karen', 22.3, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('7b4cdf68-df2d-42d5-8454-72f851e6b32a', 'Lai + Wu + Nessen + Feriancek', 2, 'green2', 85.6, 6);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('7b4cdf68-df2d-42d5-8454-72f851e6b32a', 'Lai, Jackie', 21.9, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('7b4cdf68-df2d-42d5-8454-72f851e6b32a', 'Wu, Joy', 25.1, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('7b4cdf68-df2d-42d5-8454-72f851e6b32a', 'Nessen, Natalie', 25.3, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('7b4cdf68-df2d-42d5-8454-72f851e6b32a', 'Feriancek, Lia', 13.3, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('11bb6fcc-050e-4589-8a23-17f089a5bca5', 'Stanley + Beecher + Thomason + Pacheco', 2, 'green2', 92.4, 7);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('11bb6fcc-050e-4589-8a23-17f089a5bca5', 'Stanley, Jennifer', 16.4, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('11bb6fcc-050e-4589-8a23-17f089a5bca5', 'Beecher, Julie', 22.7, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('11bb6fcc-050e-4589-8a23-17f089a5bca5', 'Thomason, Kathy', 28, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('11bb6fcc-050e-4589-8a23-17f089a5bca5', 'Pacheco, Stacy', 25.3, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('5a9ed881-f61f-418d-a24b-760e069139af', 'Grohe + Gubanc + Rosales + Mills', 2, 'green2', 94.8, 8);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('5a9ed881-f61f-418d-a24b-760e069139af', 'Grohe, Annie', 26.9, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('5a9ed881-f61f-418d-a24b-760e069139af', 'Gubanc, Angie', 15.8, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('5a9ed881-f61f-418d-a24b-760e069139af', 'Rosales, Liz', 27.6, true, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('5a9ed881-f61f-418d-a24b-760e069139af', 'Mills, Christy', 24.5, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('bf440875-f6ef-4bf7-b22c-f2767fe8047b', 'Evenson + Keith + Heald + Woods', 2, 'green2', 120.6, 9);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('bf440875-f6ef-4bf7-b22c-f2767fe8047b', 'Evenson, Barbi', 26.7, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('bf440875-f6ef-4bf7-b22c-f2767fe8047b', 'Keith, Diana', 26.7, true, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('bf440875-f6ef-4bf7-b22c-f2767fe8047b', 'Heald, Jackie', 30.3, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('bf440875-f6ef-4bf7-b22c-f2767fe8047b', 'Woods, Christina', 36.9, true, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('89466977-6e85-41d6-8b66-cd11a17f689e', 'McCloskey + Johnson + Nieto + Moser', 3, 'combo', 74.6, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('89466977-6e85-41d6-8b66-cd11a17f689e', 'McCloskey, Gail', 26, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('89466977-6e85-41d6-8b66-cd11a17f689e', 'Johnson, Jamie', 15.9, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('89466977-6e85-41d6-8b66-cd11a17f689e', 'Nieto, Lorri', 15.2, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('89466977-6e85-41d6-8b66-cd11a17f689e', 'Moser, Gail', 17.5, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('a7790dec-3534-4a30-825a-ff8f22cf1b68', 'Pereyra + Dembski + Sumner + Thiltgen', 3, 'combo', 83, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('a7790dec-3534-4a30-825a-ff8f22cf1b68', 'Pereyra, Cathy', 23, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('a7790dec-3534-4a30-825a-ff8f22cf1b68', 'Dembski, Lauren', 23.4, true, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('a7790dec-3534-4a30-825a-ff8f22cf1b68', 'Sumner, Irma', 23.3, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('a7790dec-3534-4a30-825a-ff8f22cf1b68', 'Thiltgen, Michele', 13.3, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('9f5511ec-5186-4b93-bd7b-64b307cfee2d', 'Nilsen + Fillhardt + Branco + Tokarz', 3, 'combo', 103.6, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('9f5511ec-5186-4b93-bd7b-64b307cfee2d', 'Nilsen, Lynn', 26.6, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('9f5511ec-5186-4b93-bd7b-64b307cfee2d', 'Fillhardt, Linda', 27.1, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('9f5511ec-5186-4b93-bd7b-64b307cfee2d', 'Branco, Karen', 24.2, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('9f5511ec-5186-4b93-bd7b-64b307cfee2d', 'Tokarz, Annie', 25.7, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('12b0bf7b-dac7-4b14-823b-9b540f0beb14', 'Bryson + Boyle + Scurich + Campagna', 3, 'combo', 116.7, 4);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('12b0bf7b-dac7-4b14-823b-9b540f0beb14', 'Bryson, Sharon', 30.3, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('12b0bf7b-dac7-4b14-823b-9b540f0beb14', 'Boyle, Noelle', 27.3, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('12b0bf7b-dac7-4b14-823b-9b540f0beb14', 'Scurich, Carol', 27.1, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('12b0bf7b-dac7-4b14-823b-9b540f0beb14', 'Campagna, Jeannie', 32, false, 4);

insert into mhi.teams (id, name, flight, horse_race_flight, team_index, sort) values ('6a181e1a-60d5-4498-9ed0-d46aaa66884d', 'Nicholson + Robbins + Larrick + Roberts', 3, 'combo', 120.5, 5);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6a181e1a-60d5-4498-9ed0-d46aaa66884d', 'Nicholson, Linda', 25.1, true, 1);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6a181e1a-60d5-4498-9ed0-d46aaa66884d', 'Robbins, Carol', 30, false, 2);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6a181e1a-60d5-4498-9ed0-d46aaa66884d', 'Larrick, Catherine', 28.7, false, 3);
insert into mhi.team_players (team_id, name, index, is_member, sort) values ('6a181e1a-60d5-4498-9ed0-d46aaa66884d', 'Roberts, Barb', 36.7, false, 4);

commit;
