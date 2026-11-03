import { getClerkInstance } from '@clerk/clerk-expo';
import { supabase } from './supabase';
import { Profile, City } from './database.types';

// La sesión la maneja Clerk: para cerrar sesión se usa la instancia de Clerk.
export async function signOut() {
  await getClerkInstance().signOut();
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

export async function redeemReward(_userId: string, rewardId: string, _pointsCost: number) {
  // Se hace en el servidor (función redeem_reward): valida saldo y descuenta en una sola operación.
  const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
  if (error) {
    if (error.message?.includes('Insufficient points')) throw new Error('Insufficient points');
    throw error;
  }
  return data as string;
}

