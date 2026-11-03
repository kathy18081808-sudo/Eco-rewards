import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { Profile, City } from './database.types';

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }
  return data;
}

// Iniciar sesión con Google.
// - Web: redirige a Google y vuelve a la misma página; Supabase lee la sesión de la URL.
// - Celular (Expo Go): abre Google en un navegador interno y recibe la sesión de vuelta.
export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // la persona cerró la ventana

  const params = new URLSearchParams(result.url.split('#')[1] ?? result.url.split('?')[1] ?? '');
  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(errorDescription);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw sessionError;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'alias' | 'full_name' | 'age' | 'date_of_birth' | 'avatar_url' | 'city_id'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function fetchCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function redeemReward(userId: string, rewardId: string, pointsCost: number) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('points_balance')
    .eq('id', userId)
    .single();

  if (!profile || profile.points_balance < pointsCost) {
    throw new Error('Insufficient points');
  }

  const redemptionCode = generateRedemptionCode();

  const { error: txError } = await supabase.from('transactions').insert({
    user_id: userId,
    type: 'redemption',
    points: -pointsCost,
    description: `Reward redeemed`,
  });
  if (txError) throw txError;

  const { error: balError } = await supabase
    .from('profiles')
    .update({ points_balance: profile.points_balance - pointsCost })
    .eq('id', userId);
  if (balError) throw balError;

  const { error: redError } = await supabase.from('redemptions').insert({
    user_id: userId,
    reward_id: rewardId,
    points_spent: pointsCost,
    redemption_code: redemptionCode,
  });
  if (redError) throw redError;

  return redemptionCode;
}

function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ECO-${code}`;
}
