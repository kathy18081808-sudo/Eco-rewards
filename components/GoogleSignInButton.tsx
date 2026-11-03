import React, { useState } from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';
import { clerkErrorMessage } from '../lib/clerkErrors';

// Cierra la ventana de Google al volver a la app (solo afecta al celular).
WebBrowser.maybeCompleteAuthSession();

/**
 * "Continuar con Google" usando Clerk.
 * - Web: redirige a Google y vuelve a /sso-callback, donde Clerk crea la sesión.
 * - Celular: abre Google en un navegador interno y activa la sesión al volver.
 * Sirve tanto para iniciar sesión como para registrarse por primera vez.
 */
export default function GoogleSignInButton() {
  const { signIn, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const origin = window.location.origin;
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: `${origin}/sso-callback`,
          redirectUrlComplete: `${origin}/`,
        });
        return; // el navegador se va a Google
      }

      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: Linking.createURL('sso-callback'),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (error) {
      Alert.alert('Error', clerkErrorMessage(error, 'No se pudo iniciar sesión con Google'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, (loading || !isLoaded) && styles.disabled]}
      onPress={handlePress}
      disabled={loading || !isLoaded}
    >
      {loading ? (
        <ActivityIndicator color={Colors.text} />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color="#DB4437" />
          <Text style={styles.buttonText}>Continuar con Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
