// Supabase Edge Function: add-points
// Called by ESP32 to credit recycling points to a user.
//
// POST /functions/v1/add-points
// Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// Body: { "user_id"?: "<uuid>", "account_number"?: "<digits>", "item_type": "bottle" | "can" }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const POINTS_MAP: Record<string, { points: number; description: string }> = {
  bottle: { points: 15, description: 'Bottle recycled (+15 pts)' },
  can: { points: 10, description: 'Can recycled (+10 pts)' },
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, account_number, item_type } = await req.json();

    if ((!user_id && !account_number) || !item_type) {
      return new Response(
        JSON.stringify({ error: 'Missing account_number or user_id, or item_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const itemConfig = POINTS_MAP[item_type];
    if (!itemConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid item_type. Must be "bottle" or "can"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let profileQuery = supabase
      .from('profiles')
      .select('id, points_balance, account_number');

    profileQuery = account_number
      ? profileQuery.eq('account_number', account_number)
      : profileQuery.eq('id', user_id);

    const { data: profile, error: profileError } = await profileQuery.single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert transaction
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: profile.id,
      type: item_type,
      points: itemConfig.points,
      description: itemConfig.description,
    });

    if (txError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create transaction' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update points balance
    const newBalance = profile.points_balance + itemConfig.points;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ points_balance: newBalance })
      .eq('id', profile.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        account_number: profile.account_number,
        user_id: profile.id,
        item_type,
        points_added: itemConfig.points,
        new_balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
