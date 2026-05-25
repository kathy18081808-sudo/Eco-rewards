import { supabase } from './supabase';
import { Profile } from './database.types';

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
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
  updates: Partial<Pick<Profile, 'alias' | 'full_name' | 'age' | 'date_of_birth' | 'avatar_url'>>
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
