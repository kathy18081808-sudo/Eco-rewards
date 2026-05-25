import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { Transaction } from '../../lib/database.types';
import PointsCard from '../../components/PointsCard';
import TransactionItem from '../../components/TransactionItem';
import AccountNumberModal from '../../components/AccountNumberModal';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function HomeScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [stats, setStats] = useState({ bottles: 0, cans: 0 });

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setTransactions(data);
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    const { data: bottleData } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('type', 'bottle');

    const { data: canData } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('type', 'can');

    setStats({
      bottles: bottleData?.length ?? 0,
      cans: canData?.length ?? 0,
    });
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchTransactions(), fetchStats()]);
    setRefreshing(false);
  }, [refreshProfile, fetchTransactions, fetchStats]);

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, [fetchTransactions, fetchStats]);

  // Realtime subscription for live point updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          refreshProfile();
          fetchTransactions();
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshProfile();
          fetchTransactions();
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const displayName = profile?.alias || profile?.full_name || 'Recycler';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>
          <TouchableOpacity
            style={styles.notifButton}
            onPress={() => setShowAccountNumber(true)}
          >
            <Ionicons name="keypad" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <PointsCard
          points={profile?.points_balance ?? 0}
          bottlesCount={stats.bottles}
          cansCount={stats.cans}
        />

        <TouchableOpacity
          style={styles.recycleButton}
          onPress={() => setShowAccountNumber(true)}
          activeOpacity={0.8}
        >
          <View style={styles.recycleButtonInner}>
            <Ionicons name="keypad" size={24} color={Colors.surface} />
            <Text style={styles.recycleButtonText}>Show Account Number</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No activity yet</Text>
              <Text style={styles.emptySubtext}>
                Start recycling to earn your first points!
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {user && (
        <AccountNumberModal
          visible={showAccountNumber}
          accountNumber={profile?.account_number ?? null}
          onClose={() => setShowAccountNumber(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  notifButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recycleButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  recycleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  recycleButtonText: {
    color: Colors.surface,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  transactionsList: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },
});
