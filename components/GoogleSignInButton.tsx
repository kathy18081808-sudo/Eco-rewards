import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/auth';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const BUTTON_ID = 'google-signin-button';

declare global {
  interface Window {
    google?: any;
  }
}

async function sha256Hex(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector('script[data-google-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleGsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google'));
    document.head.appendChild(script);
  });
}

/**
 * En la web usa el botón oficial de Google (Google Identity Services):
 * la ventana de Google muestra el dominio de la app (eco-rewards-web.vercel.app)
 * en lugar del dominio de Supabase. El token se valida con Supabase (signInWithIdToken).
 * En el celular, o si falta EXPO_PUBLIC_GOOGLE_CLIENT_ID, usa el método por redirección.
 */
export default function GoogleSignInButton() {
  const useGoogleButton = Platform.OS === 'web' && !!GOOGLE_CLIENT_ID;
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!useGoogleButton) return;
    let cancelled = false;

    (async () => {
      try {
        await loadGoogleScript();
        const rawNonce = crypto.randomUUID();
        const hashedNonce = await sha256Hex(rawNonce);
        if (cancelled) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
          callback: async (response: { credential: string }) => {
            setLoading(true);
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: response.credential,
              nonce: rawNonce,
            });
            setLoading(false);
            if (error) Alert.alert('Error', error.message);
          },
        });

        const container = document.getElementById(BUTTON_ID);
        if (container) {
          container.innerHTML = '';
          window.google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'rectangular',
            text: 'continue_with',
            logo_alignment: 'center',
            locale: 'es',
            width: Math.min(container.offsetWidth || 360, 400),
          });
        }
        setReady(true);
      } catch {
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useGoogleButton]);

  const handleRedirectLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  if (useGoogleButton) {
    return (
      <View style={styles.wrapper}>
        <View nativeID={BUTTON_ID} style={styles.googleContainer} />
        {(!ready || loading) && <ActivityIndicator color={Colors.textSecondary} style={styles.spinner} />}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.disabled]}
      onPress={handleRedirectLogin}
      disabled={loading}
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
  wrapper: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  googleContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  spinner: {
    marginTop: Spacing.sm,
  },
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
