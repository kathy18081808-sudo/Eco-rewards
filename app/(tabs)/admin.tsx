import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../../lib/AuthContext';
import { machineQrPayload } from '../../lib/machineSessions';
import { supabase } from '../../lib/supabase';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/theme';

interface Machine {
  id: string;
  machine_code: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminScreen() {
  const { user, profile } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const fetchMachines = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from('machines')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Could not load machines', error.message);
      return;
    }
    setMachines(data ?? []);
    if (!selectedMachine && data?.[0]) {
      setSelectedMachine(data[0]);
    }
  }, [isAdmin, selectedMachine]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMachines();
    setRefreshing(false);
  }, [fetchMachines]);

  const registerMachine = async () => {
    if (!user) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Machine name required', 'Add a display name before registering.');
      return;
    }

    setSaving(true);
    try {
      let createdMachine: Machine | null = null;
      let lastError: any = null;

      for (let attempt = 0; attempt < 5 && !createdMachine; attempt++) {
        const machineCode = generateMachineCode();
        const { data, error } = await supabase
          .from('machines')
          .insert({
            machine_code: machineCode,
            name: trimmedName,
            location: location.trim() || null,
            created_by: user.id,
          })
          .select('*')
          .single();

        if (!error && data) {
          createdMachine = data;
        } else {
          lastError = error;
        }
      }

      if (!createdMachine) {
        throw lastError || new Error('Could not generate a unique machine code.');
      }

      setName('');
      setLocation('');
      setSelectedMachine(createdMachine);
      await fetchMachines();
    } catch (error: any) {
      Alert.alert('Could not register machine', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyCard}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.textLight} />
          <Text style={styles.title}>Admin Access Required</Text>
          <Text style={styles.message}>
            Your profile must have the admin role before you can register machines.
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
          <Text style={styles.title}>Machine Admin</Text>
          <Text style={styles.message}>
            Register each physical machine, print its QR, and flash the same code into the ESP32.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Register Machine</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Machine name"
            placeholderTextColor={Colors.textLight}
          />
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Location (optional)"
            placeholderTextColor={Colors.textLight}
          />
          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={registerMachine}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.surface} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Create QR Machine</Text>
            )}
          </TouchableOpacity>
        </View>

        {selectedMachine && (
          <View style={styles.qrCard}>
            <Text style={styles.sectionTitle}>Printable QR</Text>
            <View style={styles.qrBox}>
              <QRCode
                value={machineQrPayload(selectedMachine.machine_code)}
                size={210}
                backgroundColor={Colors.surface}
                color={Colors.text}
              />
            </View>
            <Text style={styles.machineName}>{selectedMachine.name}</Text>
            <Text style={styles.machineCode}>{selectedMachine.machine_code}</Text>
            <Text style={styles.message}>
              QR payload: {machineQrPayload(selectedMachine.machine_code)}
            </Text>
          </View>
        )}

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>Machines</Text>
          <FlatList
            data={machines}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No machines registered yet.</Text>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.machineRow}
                onPress={() => setSelectedMachine(item)}
              >
                <View style={styles.machineIcon}>
                  <Ionicons name="qr-code-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.machineContent}>
                  <Text style={styles.machineRowTitle}>{item.name}</Text>
                  <Text style={styles.machineRowSub}>
                    {item.machine_code}
                    {item.location ? ` - ${item.location}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function generateMachineCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = Crypto.getRandomBytes(6);
  let suffix = '';
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `ECO-${suffix}`;
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
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
  },
  message: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  primaryButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.surface,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  qrCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  qrBox: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  machineName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  machineCode: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  emptyCard: {
    flex: 1,
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  machineIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  machineContent: {
    flex: 1,
  },
  machineRowTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  machineRowSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
