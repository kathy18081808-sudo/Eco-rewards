import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface PointsCardProps {
  points: number;
  bottlesCount: number;
  cansCount: number;
}

export default function PointsCard({ points, bottlesCount, cansCount }: PointsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        <View>
          <Text style={styles.label}>Your Balance</Text>
          <Text style={styles.points}>{points.toLocaleString()}</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>
        <View style={styles.iconBadge}>
          <Ionicons name="leaf" size={32} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: Colors.bottle + '20' }]}>
            <Ionicons name="water" size={18} color={Colors.bottle} />
          </View>
          <View>
            <Text style={styles.statValue}>{bottlesCount}</Text>
            <Text style={styles.statLabel}>Bottles</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: Colors.can + '20' }]}>
            <Ionicons name="cafe" size={18} color={Colors.can} />
          </View>
          <View>
            <Text style={styles.statValue}>{cansCount}</Text>
            <Text style={styles.statLabel}>Cans</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  points: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: Colors.primary,
    lineHeight: 50,
  },
  pointsLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
});
