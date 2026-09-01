import { supabase } from './supabase';
import {
  CityBattleEntry,
  CityLeaderboardEntry,
  MonthlyCityResult,
  MonthlyCompetition,
  MonthlyUserResult,
  NationalLeaderboardEntry,
} from './database.types';

export async function fetchCityBattle(): Promise<CityBattleEntry[]> {
  const { data, error } = await supabase
    .from('city_battle_current')
    .select('*')
    .order('rank', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCityLeaderboard(
  cityId: string,
  limit = 20
): Promise<CityLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('city_leaderboard_current')
    .select('*')
    .eq('city_id', cityId)
    .order('rank_in_city', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchNationalLeaderboard(
  limit = 20
): Promise<NationalLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('national_leaderboard_current')
    .select('*')
    .order('rank_national', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchUserCityRank(
  userId: string,
  cityId: string
): Promise<CityLeaderboardEntry | null> {
  const { data, error } = await supabase
    .from('city_leaderboard_current')
    .select('*')
    .eq('user_id', userId)
    .eq('city_id', cityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchLastFinalizedCompetition(): Promise<MonthlyCompetition | null> {
  const { data, error } = await supabase
    .from('monthly_competitions')
    .select('*')
    .eq('status', 'finalized')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMonthlyCityPodium(
  competitionId: string
): Promise<MonthlyCityResult[]> {
  const { data, error } = await supabase
    .from('monthly_city_results')
    .select('*, cities(name)')
    .eq('competition_id', competitionId)
    .lte('rank', 3)
    .order('rank', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMonthlyUserPodium(
  competitionId: string
): Promise<MonthlyUserResult[]> {
  const { data, error } = await supabase
    .from('monthly_user_results')
    .select('*, profiles(alias, full_name), cities(name)')
    .eq('competition_id', competitionId)
    .lte('rank_national', 3)
    .order('rank_national', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchUserMedals(userId: string): Promise<MonthlyUserResult[]> {
  const { data, error } = await supabase
    .from('monthly_user_results')
    .select('*, monthly_competitions(year, month)')
    .eq('user_id', userId)
    .neq('medal_tier', 'none')
    .order('competition_id', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function getDisplayName(
  alias?: string | null,
  fullName?: string | null,
  fallback = 'Recycler'
): string {
  return alias?.trim() || fullName?.trim() || fallback;
}

export function getCityNameFromResult(result: MonthlyCityResult): string {
  return result.cities?.name ?? 'Unknown';
}

export function getUserNameFromResult(result: MonthlyUserResult): string {
  return getDisplayName(result.profiles?.alias, result.profiles?.full_name);
}
