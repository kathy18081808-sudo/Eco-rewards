import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  fetchCityBattle,
  fetchCityLeaderboard,
  fetchLastFinalizedCompetition,
  fetchMonthlyCityPodium,
  fetchMonthlyUserPodium,
  fetchUserCityRank,
  fetchUserMedals,
  getCityNameFromResult,
  getUserNameFromResult,
} from '../../lib/ranking';
import {
  CityBattleEntry,
  CityLeaderboardEntry,
  MonthlyCityResult,
  MonthlyCompetition,
  MonthlyUserResult,
} from '../../lib/database.types';
import CityBattleCard from '../../components/CityBattleCard';
import CityPerformanceList from '../../components/CityPerformanceList';
import MedalBadge from '../../components/MedalBadge';
import Podium from '../../components/Podium';
import {
  computeMedalTier,
  formatCompetitionMonth,
  getNextMedalTier,
  MEDAL_LABELS,
} from '../../constants/medals';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function RankingScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [cityBattle, setCityBattle] = useState<CityBattleEntry[]>([]);
  const [cityLeaderboard, setCityLeaderboard] = useState<CityLeaderboardEntry[]>([]);
  const [userCityRank, setUserCityRank] = useState<CityLeaderboardEntry | null>(null);
  const [cityChampion, setCityChampion] = useState<CityLeaderboardEntry | null>(null);
  const [lastCompetition, setLastCompetition] = useState<MonthlyCompetition | null>(null);
  const [cityPodium, setCityPodium] = useState<MonthlyCityResult[]>([]);
  const [userPodium, setUserPodium] = useState<MonthlyUserResult[]>([]);
  const [userMedals, setUserMedals] = useState<MonthlyUserResult[]>([]);

  const loadData = useCallback(async () => {
    if (!user || !profile?.city_id) return;

    const [
      battle,
      leaderboard,
      rank,
      competition,
      medals,
    ] = await Promise.all([
      fetchCityBattle(),
      fetchCityLeaderboard(profile.city_id, 20),
      fetchUserCityRank(user.id, profile.city_id),
      fetchLastFinalizedCompetition(),
      fetchUserMedals(user.id),
    ]);

    setCityBattle(battle);
    setCityLeaderboard(leaderboard);
    setUserCityRank(rank);
    setCityChampion(leaderboard[0] ?? null);
    setLastCompetition(competition);
    setUserMedals(medals);

    if (competition) {
      const [cities, users] = await Promise.all([
        fetchMonthlyCityPodium(competition.id),
        fetchMonthlyUserPodium(competition.id),
      ]);
      setCityPodium(cities);
      setUserPodium(users);
    } else {
      setCityPodium([]);
      setUserPodium([]);
    }
  }, [user, profile?.city_id]);

  useEffect(() => {
    loadData().catch(() => {});
  }, [loadData]);

  useEffect(() => {
    if (!user) return;

    const channel = supabaseChannel(user.id, () => {
      refreshProfile();
      loadData().catch(() => {});
    });

    return () => {
      channel();
    };
  }, [user, loadData, refreshProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), loadData()]);
    setRefreshing(false);
  }, [refreshProfile, loadData]);

  const leadingCity = cityBattle[0] ?? null;
  const secondCity = cityBattle[1] ?? null;
  const userCityEntry = cityBattle.find((city) => city.city_id === profile?.city_id) ?? null;
  const monthlyPoints = profile?.monthly_eco_points ?? 0;
  const currentMedal = computeMedalTier(monthlyPoints);
  const nextMedal = getNextMedalTier(monthlyPoints);

  if (!profile?.city_id) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>Select your department</Text>
          <Text style={styles.emptyText}>
            Complete your profile with a department to join the monthly ranking battle.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ranking</Text>
          <Text style={styles.subtitle}>Monthly eco-points battle by department</Text>
        </View>

        <CityBattleCard
          leadingCity={leadingCity}
          secondCity={secondCity}
          userCityId={profile.city_id}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your City Champion</Text>
          <View style={styles.championCard}>
            <Ionicons name="star" size={22} color={Colors.accent} />
            <View style={styles.championContent}>
              <Text style={styles.championName}>
                {cityChampion?.display_name ?? 'No champion yet'}
              </Text>
              <Text style={styles.championMeta}>
                {cityChampion
                  ? `${cityChampion.monthly_eco_points} eco-points this month`
                  : 'Be the first recycler in your city'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Standing</Text>
          <View style={styles.standingCard}>
            <View style={styles.standingRow}>
              <View style={styles.standingStat}>
                <Text style={styles.standingValue}>
                  {userCityRank ? `#${userCityRank.rank_in_city}` : '-'}
                </Text>
                <Text style={styles.standingLabel}>City Rank</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.standingStat}>
                <Text style={styles.standingValue}>{monthlyPoints}</Text>
                <Text style={styles.standingLabel}>Eco-Points</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.standingStat}>
                <Text style={styles.standingValue}>
                  {userCityEntry ? `#${userCityEntry.rank}` : '-'}
                </Text>
                <Text style={styles.standingLabel}>City Battle</Text>
              </View>
            </View>
            <View style={styles.medalRow}>
              {currentMedal !== 'none' ? (
                <MedalBadge tier={currentMedal} size="sm" subtitle="Current tier" />
              ) : (
                <Text style={styles.noMedalText}>No medal yet this month</Text>
              )}
              {nextMedal ? (
                <Text style={styles.nextMedalText}>
                  {nextMedal.pointsNeeded} pts to {MEDAL_LABELS[nextMedal.tier]}
                </Text>
              ) : (
                <Text style={styles.nextMedalText}>Top medal reached!</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Cities Performance</Text>
          <CityPerformanceList cities={cityBattle} userCityId={profile.city_id} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>City Leaderboard</Text>
          <View style={styles.leaderboardCard}>
            {cityLeaderboard.length === 0 ? (
              <Text style={styles.emptyListText}>No recyclers ranked in your city yet.</Text>
            ) : (
              cityLeaderboard.map((entry) => {
                const isCurrentUser = entry.user_id === user?.id;
                return (
                  <View
                    key={entry.user_id}
                    style={[styles.leaderboardRow, isCurrentUser && styles.leaderboardRowActive]}
                  >
                    <Text style={styles.leaderboardRank}>#{entry.rank_in_city}</Text>
                    <Text style={styles.leaderboardName} numberOfLines={1}>
                      {entry.display_name}
                    </Text>
                    <Text style={styles.leaderboardPoints}>{entry.monthly_eco_points}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {lastCompetition ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Last Month: {formatCompetitionMonth(lastCompetition.year, lastCompetition.month)}
              </Text>
              <Text style={styles.sectionSubtitle}>Top 3 Cities</Text>
              <Podium
                entries={cityPodium.map((entry) => ({
                  rank: entry.rank,
                  name: getCityNameFromResult(entry),
                  points: entry.total_eco_points,
                  subtitle: `${entry.recycler_count} recyclers`,
                }))}
                emptyMessage="No city podium for last month."
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionSubtitle}>Top 3 Recyclers</Text>
              <Podium
                entries={userPodium.map((entry) => ({
                  rank: entry.rank_national,
                  name: getUserNameFromResult(entry),
                  points: entry.eco_points,
                  subtitle: entry.cities?.name ?? undefined,
                }))}
                emptyMessage="No recycler podium for last month."
              />
            </View>
          </>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Medals</Text>
          {userMedals.length === 0 ? (
            <Text style={styles.emptyListText}>Earn medals by recycling each month.</Text>
          ) : (
            <View style={styles.medalsGrid}>
              {userMedals.map((medal) => {
                if (medal.medal_tier === 'none') return null;
                const competition = medal.monthly_competitions;
                return (
                  <MedalBadge
                    key={medal.id}
                    tier={medal.medal_tier}
                    size="sm"
                    subtitle={
                      competition
                        ? formatCompetitionMonth(competition.year, competition.month)
                        : undefined
                    }
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function supabaseChannel(userId: string, onChange: () => void) {
  const channelTopic = `ranking-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const channel = supabase
    .channel(channelTopic)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  championCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  championContent: {
    flex: 1,
    gap: 4,
  },
  championName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  championMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  standingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  standingStat: {
    flex: 1,
    alignItems: 'center',
  },
  standingValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  standingLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
  },
  medalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  noMedalText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  nextMedalText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  leaderboardCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  leaderboardRowActive: {
    backgroundColor: Colors.primaryLight,
  },
  leaderboardRank: {
    width: 36,
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
  },
  leaderboardName: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '600',
  },
  leaderboardPoints: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyListText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    padding: Spacing.md,
  },
  medalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
