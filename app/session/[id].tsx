import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/theme';

type SessionStatus = 'armed' | 'completed' | 'expired' | 'cancelled';

interface SessionDetails {
  id: string;
  status: SessionStatus;
  expires_at: string;
  items_processed: number;
  machines?: {
    name: string;
    machine_code: string;
  } | null;
}

export default function RecyclingSessionScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const { id, machine_name, expires_at } = useLocalSearchParams<{
    id: string;
    machine_name?: string;
    expires_at?: string;
  }>();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(Date.now());

  const fetchSession = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('recycling_sessions')
      .select(`
        id,
        status,
        expires_at,
        items_processed,
        machines:machine_id (
          name,
          machine_code
        )
      `)
      .eq('id', id)
      .single();

    if (!error && data) {
      setSession({
        ...data,
        machines: Array.isArray(data.machines) ? data.machines[0] : data.machines,
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`recycling-session-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recycling_sessions',
          filter: `id=eq.${id}`,
        },
        () => {
          fetchSession();
          refreshProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSession, id, refreshProfile]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fallbackMachineName = typeof machine_name === 'string' ? machine_name : 'Machine';
  const fallbackExpiresAt = typeof expires_at === 'string' ? expires_at : null;
  const displayMachineName = session?.machines?.name || fallbackMachineName;
  const expiresAt = session?.expires_at || fallbackExpiresAt;
  const secondsRemaining = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  }, [expiresAt, now]);

  const status = session?.status || (secondsRemaining > 0 ? 'armed' : 'expired');
  const isActive = status === 'armed' && secondsRemaining > 0;

  const handleCancel = async () => {
    if (!id) return;
    setCancelling(true);

    const { error } = await supabase
      .from('recycling_sessions')
      .update({ status: 'cancelled' })
      .eq('id', id);

    setCancelling(false);
    if (error) {
      Alert.alert('Could not cancel session', error.message);
      return;
    }
    router.replace('/(tabs)');
  };

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerCard}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.message}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Machine Session</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.statusCard}>
        <View style={[styles.statusIcon, !isActive && styles.statusIconInactive]}>
          <Ionicons
            name={isActive ? 'radio-outline' : 'time-outline'}
            size={44}
            color={isActive ? Colors.primary : Colors.textLight}
          />
        </View>
        <Text style={styles.statusTitle}>
          {isActive ? 'Machine Armed' : statusLabel(status)}
        </Text>
        <Text style={styles.machineName}>{displayMachineName}</Text>
        <Text style={styles.statusMessage}>
          {isActive
            ? 'Insert a bottle or can. The ESP32-CAM will detect it and credit your account.'
            : 'This machine session is no longer accepting items.'}
        </Text>

        <View style={styles.countdownCard}>
          <Text style={styles.countdownValue}>{secondsRemaining}s</Text>
          <Text style={styles.countdownLabel}>remaining</Text>
        </View>
      </View>

      <View style={styles.detailsCard}>
        <DetailRow label="Current points" value={`${profile?.points_balance ?? 0}`} />
        <DetailRow label="Items in this session" value={`${session?.items_processed ?? 0}`} />
        <DetailRow label="Status" value={statusLabel(status)} />
      </View>

      {isActive && (
        <TouchableOpacity
          style={[styles.cancelButton, cancelling && styles.disabledButton]}
          onPress={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? (
            <ActivityIndicator color={Colors.error} size="small" />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel Session</Text>
          )}
        </TouchableOpacity>
      )}

      {!isActive && (
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function statusLabel(status: SessionStatus) {
  if (status === 'armed') return 'Armed';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Expired';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusIcon: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconInactive: {
    backgroundColor: Colors.surfaceAlt,
  },
  statusTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  machineName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  statusMessage: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  countdownCard: {
    minWidth: 120,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    alignItems: 'center',
  },
  countdownValue: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
  },
  countdownLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailsCard: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  cancelButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    backgroundColor: Colors.error + '10',
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.error,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.surface,
  },
});
