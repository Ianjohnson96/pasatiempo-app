import { createAdminClient, hasSupabase } from "./supabase";

export type Player = { name: string; isMember: boolean; index: number | null };

export type Team = {
  id: string;
  name: string | null;
  flight: number | null; // tournament flight: 1, 2, or 3
  horseRaceFlight: string | null; // 'green1' | 'green2' | 'combo'
  teamIndex: number | null; // combined team index from the flight report
  players: Player[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */

// Reads all teams + their players from Supabase. Returns [] on any failure or
// when Supabase isn't configured yet, so the page always renders (showing the
// "TBA" placeholder until real data exists).
export async function getTeams(): Promise<Team[]> {
  if (!hasSupabase()) return [];
  try {
    const sb = createAdminClient();
    const { data: teams, error } = await sb
      .from("teams")
      .select("id, name, flight, horse_race_flight, team_index, sort")
      .order("flight", { ascending: true, nullsFirst: false })
      .order("sort", { ascending: true });
    if (error || !teams) return [];

    const ids = teams.map((t: any) => t.id);
    let players: any[] = [];
    if (ids.length) {
      const { data: pl } = await sb
        .from("team_players")
        .select("team_id, name, is_member, index, sort")
        .in("team_id", ids)
        .order("sort", { ascending: true });
      players = pl || [];
    }

    return teams.map((t: any) => ({
      id: t.id,
      name: t.name ?? null,
      flight: t.flight ?? null,
      horseRaceFlight: t.horse_race_flight ?? null,
      teamIndex: t.team_index ?? null,
      players: players
        .filter((p) => p.team_id === t.id)
        .map((p) => ({
          name: p.name,
          isMember: Boolean(p.is_member),
          index: p.index ?? null,
        })),
    }));
  } catch {
    return [];
  }
}
