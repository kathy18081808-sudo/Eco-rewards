import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SESSION_TTL_MS = 60_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function armedSessionResponse({
  session,
  machine,
  profile,
}: {
  session: { id: string; expires_at: string };
  machine: { id: string; machine_code: string; name: string };
  profile: { account_number: string | null; alias: string | null; full_name: string | null };
}) {
  return jsonResponse({
    session_id: session.id,
    machine_id: machine.id,
    machine_code: machine.machine_code,
    machine_name: machine.name,
    expires_at: session.expires_at,
    account_number: profile.account_number,
    display_name: profile.alias || profile.full_name || 'Recycler',
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing user authorization' }, 401);
    }

    const { machine_code } = await req.json();
    const machineCode = String(machine_code || '').trim().toUpperCase();
    if (!machineCode) {
      return jsonResponse({ error: 'Missing machine_code' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) {
      return jsonResponse({ error: 'Invalid user session' }, 401);
    }

    const { data: machine, error: machineError } = await serviceClient
      .from('machines')
      .select('id, machine_code, name, is_active')
      .eq('machine_code', machineCode)
      .eq('is_active', true)
      .single();

    if (machineError || !machine) {
      return jsonResponse({ error: 'Machine not found or inactive' }, 404);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, account_number, alias, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: 'User profile not found' }, 404);
    }

    const now = new Date().toISOString();
    const { data: existingSession, error: existingSessionError } = await serviceClient
      .from('recycling_sessions')
      .select('id, expires_at')
      .eq('machine_id', machine.id)
      .eq('user_id', user.id)
      .eq('status', 'armed')
      .gt('expires_at', now)
      .order('armed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSessionError) {
      return jsonResponse({ error: 'Could not load existing machine session' }, 500);
    }

    if (existingSession) {
      return armedSessionResponse({ session: existingSession, machine, profile });
    }

    await serviceClient
      .from('recycling_sessions')
      .update({ status: 'cancelled' })
      .eq('status', 'armed')
      .or(`user_id.eq.${user.id},machine_id.eq.${machine.id}`);

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const { data: session, error: sessionError } = await serviceClient
      .from('recycling_sessions')
      .insert({
        machine_id: machine.id,
        user_id: user.id,
        status: 'armed',
        source: 'qr',
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single();

    if (sessionError || !session) {
      const { data: racedSession } = await serviceClient
        .from('recycling_sessions')
        .select('id, expires_at')
        .eq('machine_id', machine.id)
        .eq('user_id', user.id)
        .eq('status', 'armed')
        .gt('expires_at', new Date().toISOString())
        .order('armed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (racedSession) {
        return armedSessionResponse({ session: racedSession, machine, profile });
      }

      return jsonResponse({ error: 'Could not arm machine session' }, 500);
    }

    return armedSessionResponse({ session, machine, profile });
  } catch (_error) {
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
