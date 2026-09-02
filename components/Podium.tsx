import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

export interface PodiumEntry {
  rank: number;
  name: string;
  subtitle?: string;
  points: number;
}

interface PodiumProps {
  entries: PodiumEntry[];
  emptyMessage?: string;
}

const RANK_META = {
  1: { icon: 'trophy' as const, color: '#F59E0B', height: 120 },
  2: { icon: 'medal' as const, color: '#9CA3AF', height: 96 },
  3: { icon: 'medal' as const, color: '#CD7F32', height: 84 },
};

export default function Podium({
  entries,
  emptyMessage = 'No podium data yet',
}: PodiumProps) {
  const ordered = [2, 1, 3]
    .map((rank) => entries.find((entry) => entry.rank === rank))
    .filter(Boolean) as PodiumEntry[];

  if (ordered.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {ordered.map((entry) => {
        const meta = RANK_META[entry.rank as 1 | 2 | 3];
        return (
          <View key={entry.rank} style={styles.slot}>
            <View style={[styles.pillar, { height: meta.height, borderColor: meta.color }]}>
              <Ionicons name={meta.icon} size={22} color={meta.color} />
              <Text style={styles.rankLabel}>#{entry.rank}</Text>
              <Text style={styles.name} numberOfLines={2}>
                {entry.name}
              </Text>
              {entry.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {entry.subtitle}
                </Text>
              ) : null}
              <Text style={styles.points}>{entry.points} pts</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
  },
  pillar: {
    width: '100%',
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  rankLabel: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    textAlign: 'center',
  },
  points: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  empty: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
