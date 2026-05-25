import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../lib/database.types';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

interface TransactionItemProps {
  transaction: Transaction;
}

const TYPE_CONFIG = {
  bottle: {
    icon: 'water' as const,
    color: Colors.bottle,
    bg: Colors.bottle + '15',
    label: 'Bottle Recycled',
  },
  can: {
    icon: 'cafe' as const,
    color: Colors.can,
    bg: Colors.can + '15',
    label: 'Can Recycled',
  },
  redemption: {
    icon: 'gift' as const,
    color: Colors.redemption,
    bg: Colors.redemption + '15',
    label: 'Reward Redeemed',
  },
};

export default function TransactionItem({ transaction }: TransactionItemProps) {
  const config = TYPE_CONFIG[transaction.type];
  const isPositive = transaction.points > 0;
  const timeAgo = getTimeAgo(new Date(transaction.created_at));

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>{config.label}</Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
      <Text style={[styles.points, { color: isPositive ? Colors.success : Colors.redemption }]}>
        {isPositive ? '+' : ''}{transaction.points}
      </Text>
    </View>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  points: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
});
