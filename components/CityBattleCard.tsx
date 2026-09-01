import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CityBattleEntry } from '../lib/database.types';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface CityBattleCardProps {
  leadingCity: CityBattleEntry | null;
  secondCity: CityBattleEntry | null;
  userCityId?: string | null;
}

export default function CityBattleCard({
  leadingCity,
  secondCity,
  userCityId,
}: CityBattleCardProps) {
  if (!leadingCity) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Battle of the Month</Text>
        <Text style={styles.empty}>No city activity yet this month.</Text>
      </View>
    );
  }

  const margin =
    secondCity && secondCity.total_eco_points > 0
      ? leadingCity.total_eco_points - secondCity.total_eco_points
      : leadingCity.total_eco_points;
  const isUserCity = leadingCity.city_id === userCityId;

  return (
    <View style={[styles.card, isUserCity && styles.userCityCard]}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <Ionicons name="flag" size={20} color={Colors.surface} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Battle of the Month</Text>
          <Text style={styles.title}>{leadingCity.city_name}</Text>
        </View>
      </View>
      <Text style={styles.points}>{leadingCity.total_eco_points} eco-points</Text>
      <Text style={styles.meta}>
        {leadingCity.recycler_count} recyclers active
        {secondCity ? ` · +${margin} pts ahead of #2` : ''}
      </Text>
      {isUserCity ? (
        <View style={styles.highlightBadge}>
          <Ionicons name="sparkles" size={14} color={Colors.primaryDark} />
          <Text style={styles.highlightText}>Your city is leading!</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  userCityCard: {
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primaryLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.surface,
    marginTop: 2,
  },
  points: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.surface,
    marginTop: Spacing.md,
  },
  meta: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    marginTop: Spacing.xs,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  highlightText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    marginTop: Spacing.sm,
  },
});
