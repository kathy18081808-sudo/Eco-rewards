import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { supabase, setSupabaseTokenGetter } from './supabase';
import { Profile } from './database.types';

// "user" es el perfil de Supabase (su id es el que usan todas las tablas),
// no el usuario de Clerk. Así el resto de pantallas no cambia.
interface AppUser {
  id: string;
  email: string;
}

interface AuthContextType {
  session: { clerkUserId: string } | null;
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken, signOut } = useClerkAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Supabase pide el token de Clerk en cada petición.
  useEffect(() => {
    setSupabaseTokenGetter(isSignedIn ? () => getToken() : null);
  }, [isSignedIn, getToken]);

  const loadProfile = useCallback(async () => {
    // Crea el perfil en el primer inicio de sesión y lo devuelve.
    const { data, error } = await supabase.rpc('ensure_profile');
    if (error) throw error;
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    loadProfile()
      .catch((error) => {
        if (cancelled) return;
        Alert.alert('No se pudo cargar tu perfil', error?.message || 'Intenta de nuevo.');
        signOut();
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, loadProfile, signOut]);

  const refreshProfile = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      await loadProfile();
    } catch {
      // se mantiene el perfil anterior
    }
  }, [isSignedIn, loadProfile]);

  const signedInWithProfile = !!isSignedIn && !!profile;

  return (
    <AuthContext.Provider
      value={{
        session: signedInWithProfile && userId ? { clerkUserId: userId } : null,
        user: signedInWithProfile ? { id: profile!.id, email: profile!.email } : null,
        profile,
        loading: !isLoaded || profileLoading || (!!isSignedIn && !profile),
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
