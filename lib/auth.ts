import { supabase } from './supabase';
import { Profile, City } from './database.types';

export async function signUpWithEmail(email: string, password: string) {
  // #region agent log
  fetch('http://127.0.0.1:7383/ingest/1707485f-513b-4f39-85a2-02df44127faa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab5d10'},body:JSON.stringify({sessionId:'ab5d10',runId:'signup-rate-limit',hypothesisId:'H1,H2,H3,H4',location:'lib/auth.ts:5',message:'supabase auth signup called',data:{emailLength:email.length,passwordLength:password.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7383/ingest/1707485f-513b-4f39-85a2-02df44127faa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab5d10'},body:JSON.stringify({sessionId:'ab5d10',runId:'signup-rate-limit',hypothesisId:'H1,H2,H3,H4',location:'lib/auth.ts:9',message:'supabase auth signup returned error',data:{name:error.name,status:error.status,code:error.code,message:error.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw error;
  }
  // #region agent log
  fetch('http://127.0.0.1:7383/ingest/1707485f-513b-4f39-85a2-02df44127faa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ab5d10'},body:JSON.stringify({sessionId:'ab5d10',runId:'signup-rate-limit',hypothesisId:'H5',location:'lib/auth.ts:15',message:'supabase auth signup returned success',data:{hasUser:!!data.user,hasSession:!!data.session},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7750/ingest/7e03f6b1-e711-423e-9999-0fc0bde084c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e31d77'},body:JSON.stringify({sessionId:'e31d77',runId:'city-picker-initial',hypothesisId:'H1,H2,H3',location:'lib/auth.ts:57',message:'fetchCities started',data:{table:'cities'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('sort_order', { ascending: true });
  // #region agent log
  fetch('http://127.0.0.1:7750/ingest/7e03f6b1-e711-423e-9999-0fc0bde084c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e31d77'},body:JSON.stringify({sessionId:'e31d77',runId:'city-picker-initial',hypothesisId:'H1,H2,H3',location:'lib/auth.ts:62',message:'fetchCities completed',data:{hasError:!!error,errorCode:error?.code,errorMessage:error?.message,rowCount:data?.length??0,firstCity:data?.[0]?.name,lastCity:data?.[data.length-1]?.name},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
