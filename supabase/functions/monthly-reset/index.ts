// Supabase Edge Function: monthly-reset
// Finalizes the previous calendar month (America/El_Salvador), archives podiums,
// assigns medals, and resets monthly_eco_points for all users.
//
// POST /functions/v1/monthly-reset
// Headers: Authorization: Bearer <service_role or CRON_SECRET>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getElSalvadorParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
}

function getPreviousMonth(year: number, month: number) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

function isAuthorized(req: Request) {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const headerSecret = req.headers.get('x-cron-secret');
  if (cronSecret && headerSecret === cronSecret) {
    return true;
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const bearer = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  return serviceRoleKey.length > 0 && bearer === serviceRoleKey;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    let targetYear: number | undefined;
    let targetMonth: number | undefined;

    if (req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      if (body?.year && body?.month) {
        targetYear = Number(body.year);
        targetMonth = Number(body.month);
      }
    }

    if (!targetYear || !targetMonth) {
      const now = getElSalvadorParts(new Date());
      const previous = getPreviousMonth(now.year, now.month);
      targetYear = previous.year;
      targetMonth = previous.month;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: result, error: rpcError } = await supabase.rpc('finalize_monthly_competition', {
      p_year: targetYear,
      p_month: targetMonth,
    });

    if (rpcError) {
      return jsonResponse({ error: rpcError.message }, 500);
    }

    const { data: competition } = await supabase
      .from('monthly_competitions')
      .select('id')
      .eq('year', targetYear)
      .eq('month', targetMonth)
      .single();

    let topCities: unknown[] = [];
    let topUsers: unknown[] = [];

    if (competition?.id) {
      const { data: cities } = await supabase
        .from('monthly_city_results')
        .select('rank, total_eco_points, cities(name)')
        .eq('competition_id', competition.id)
        .lte('rank', 3)
        .order('rank', { ascending: true });

      const { data: users } = await supabase
        .from('monthly_user_results')
        .select('rank_national, eco_points, medal_tier, profiles(alias, full_name), cities(name)')
        .eq('competition_id', competition.id)
        .lte('rank_national', 3)
        .order('rank_national', { ascending: true });

      topCities = cities ?? [];
      topUsers = users ?? [];
    }

    return jsonResponse({
      ...((result as Record<string, unknown>) ?? {}),
      target_year: targetYear,
      target_month: targetMonth,
      top_cities: topCities,
      top_users: topUsers,
    });
  } catch (_error) {
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
