import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CityBattleEntry } from '../lib/database.types';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface CityPerformanceListProps {
  cities: CityBattleEntry[];
  userCityId?: string | null;
}

export default function CityPerformanceList({
  cities,
  userCityId,
}: CityPerformanceListProps) {
  const maxPoints = Math.max(...cities.map((city) => city.total_eco_points), 1);

  return (
    <View style={styles.list}>
      {cities.map((city) => {
        const widthPercent = Math.max((city.total_eco_points / maxPoints) * 100, 4);
        const isUserCity = city.city_id === userCityId;

        return (
          <View
            key={city.city_id}
            style={[styles.row, isUserCity && styles.userRow]}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{city.rank}</Text>
            </View>
            <View style={styles.content}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{city.city_name}</Text>
                <Text style={styles.points}>{city.total_eco_points} pts</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${widthPercent}%` }]} />
              </View>
              <Text style={styles.meta}>{city.recycler_count} active recyclers</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  userRow: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  rankBadge: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  points: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  barTrack: {
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  meta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
