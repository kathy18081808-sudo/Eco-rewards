import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { armMachineSession, parseMachineCode } from '../lib/machineSessions';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/theme';

export default function ScanMachineScreen() {
  const router = useRouter();
  const { machine_code } = useLocalSearchParams<{ machine_code?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [arming, setArming] = useState(false);
  const [lockedCode, setLockedCode] = useState<string | null>(null);
  const armingRef = useRef(false);

  const armMachine = useCallback(
    async (machineCode: string) => {
      if (armingRef.current) return;
      armingRef.current = true;
      setArming(true);
      setLockedCode(machineCode);

      try {
        const session = await armMachineSession(machineCode);
        router.replace({
          pathname: '/session/[id]',
          params: {
            id: session.session_id,
            machine_name: session.machine_name,
            expires_at: session.expires_at,
          },
        });
      } catch (error: any) {
        armingRef.current = false;
        setLockedCode(null);
        Alert.alert('Could not arm machine', error.message || 'Please try scanning again.');
      } finally {
        setArming(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const code = typeof machine_code === 'string' ? parseMachineCode(machine_code) : null;
    if (code && code !== lockedCode) {
      armMachine(code);
    }
  }, [armMachine, lockedCode, machine_code]);

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    const machineCode = parseMachineCode(data);
    if (!machineCode || lockedCode) return;
    armMachine(machineCode);
  };

  if (!permission) {
    return (
      <CenteredState
        icon="camera-outline"
        title="Preparing camera"
        message="Checking camera permissions..."
      />
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionCard}>
          <Ionicons name="qr-code-outline" size={56} color={Colors.primary} />
          <Text style={styles.title}>Scan Machine QR</Text>
          <Text style={styles.message}>
            EcoRewards needs camera access to scan the unique QR code on the machine.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Allow Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Machine QR</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={lockedCode ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View pointerEvents="none" style={styles.scanFrame} />
      </View>

      <View style={styles.instructions}>
        {arming ? (
          <>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.instructionTitle}>Arming machine...</Text>
            <Text style={styles.instructionText}>{lockedCode}</Text>
          </>
        ) : (
          <>
            <Text style={styles.instructionTitle}>Point your camera at the machine QR</Text>
            <Text style={styles.instructionText}>
              The app will validate your account and arm the ESP32 controller automatically.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function CenteredState({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.permissionCard}>
        <Ionicons name={icon} size={56} color={Colors.primary} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
  },
  cameraWrap: {
    flex: 1,
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.text,
  },
  camera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 240,
    height: 240,
    marginTop: -120,
    marginLeft: -120,
    borderWidth: 3,
    borderColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'transparent',
  },
  instructions: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  instructionTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionCard: {
    flex: 1,
    margin: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.surface,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
