import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MedalTier } from '../lib/database.types';
import { MEDAL_COLORS, MEDAL_LABELS } from '../constants/medals';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface MedalBadgeProps {
  tier: Exclude<MedalTier, 'none'>;
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}

const SIZE_MAP = {
  sm: { box: 56, icon: 18, label: FontSize.xs },
  md: { box: 72, icon: 24, label: FontSize.sm },
  lg: { box: 88, icon: 30, label: FontSize.md },
};

export default function MedalBadge({ tier, size = 'md', subtitle }: MedalBadgeProps) {
  const dimensions = SIZE_MAP[size];
  const color = MEDAL_COLORS[tier];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: dimensions.box,
            height: dimensions.box,
            borderColor: color,
            backgroundColor: `${color}20`,
          },
        ]}
      >
        <Ionicons name="ribbon" size={dimensions.icon} color={color} />
      </View>
      <Text style={[styles.label, { fontSize: dimensions.label }]}>{MEDAL_LABELS[tier]}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
