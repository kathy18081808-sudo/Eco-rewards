import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reward } from '../lib/database.types';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface RewardItemProps {
  reward: Reward;
  userPoints: number;
  onRedeem: (reward: Reward) => void;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  coffee: 'cafe',
  food: 'fast-food',
  drinks: 'water',
  snacks: 'pizza',
};

export default function RewardItem({ reward, userPoints, onRedeem }: RewardItemProps) {
  const canAfford = userPoints >= reward.points_cost;

  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        {reward.image_url ? (
          <Image source={{ uri: reward.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name={CATEGORY_ICONS[reward.category] || 'gift'}
              size={32}
              color={Colors.primary}
            />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.brand}>{reward.brand}</Text>
        <Text style={styles.name} numberOfLines={1}>{reward.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{reward.description}</Text>

        <View style={styles.footer}>
          <View style={styles.pointsBadge}>
            <Ionicons name="leaf" size={14} color={Colors.primary} />
            <Text style={styles.pointsText}>{reward.points_cost}</Text>
          </View>

          <TouchableOpacity
            style={[styles.redeemButton, !canAfford && styles.redeemDisabled]}
            onPress={() => canAfford && onRedeem(reward)}
            disabled={!canAfford}
          >
            <Text style={[styles.redeemText, !canAfford && styles.redeemTextDisabled]}>
              {canAfford ? 'Redeem' : 'Not enough'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageContainer: {
    height: 130,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    padding: Spacing.md,
  },
  brand: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  description: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  pointsText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  redeemButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  redeemDisabled: {
    backgroundColor: Colors.surfaceAlt,
  },
  redeemText: {
    color: Colors.surface,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  redeemTextDisabled: {
    color: Colors.textLight,
  },
});
