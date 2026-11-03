import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { parseMachineCode } from '../lib/machineSessions';
import { Colors } from '../constants/theme';
import { Alert, Platform } from 'react-native';

// En el navegador, Alert.alert de React Native no muestra nada.
// Lo reemplazamos por los diálogos del navegador para que la versión web muestre los mensajes.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    const confirm = [...buttons].reverse().find((b) => b !== cancel) ?? buttons[buttons.length - 1];
    if (window.confirm(text)) {
      confirm?.onPress?.();
    } else {
      cancel?.onPress?.();
    }
  };
}

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (profile && ((!profile.full_name && !profile.alias) || !profile.city_id)) {
      if (segments.join('/') !== '(auth)/profile-setup') {
        router.replace('/(auth)/profile-setup');
      }
    } else {
      if (inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [session, profile, loading, segments]);

  useEffect(() => {
    const openMachineLink = (url: string | null) => {
      if (!url) return;
      const machineCode = parseMachineCode(url);
      if (!machineCode) return;

      router.push({
        pathname: '/scan',
        params: { machine_code: machineCode },
      });
    };

    Linking.getInitialURL().then(openMachineLink);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      openMachineLink(url);
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="session/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
