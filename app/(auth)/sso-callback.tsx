import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';

// Página a la que vuelve Google en la versión web. Clerk termina de crear la sesión
// (inicio de sesión o registro nuevo) y la app pasa sola al perfil o al inicio.
export default function SSOCallback() {
  const clerk = useClerk();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    clerk
      .handleRedirectCallback({ signInFallbackRedirectUrl: '/', signUpFallbackRedirectUrl: '/' })
      .catch(() => router.replace('/(auth)/login'));
  }, [clerk, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
