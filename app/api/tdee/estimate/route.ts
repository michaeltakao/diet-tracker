/**
 * POST /api/tdee/estimate
 *
 * Computes today's TDEE estimate for the authenticated user using the rolling
 * 14-day regression in lib/tdee.ts, then upserts the result into tdee_estimates.
 *
 * Request body (JSON):
 *   {
 *     weightLogs:  Array<{ date: string; weightKg: number }>,
 *     calorieLogs: Array<{ date: string; totalKcal: number }>,
 *     // optional Mifflin-St Jeor fallback params
 *     weightKg?:  number,
 *     heightCm?:  number,
 *     age?:       number,
 *     sex?:       'male' | 'female'
 *   }
 *
 * Response (200):
 *   { tdeeKcal: number | null, rSquared: number | null, dataPoints: number, isFallback: boolean, date: string }
 *
 * 401 — not authenticated
 * 400 — missing / malformed body
 */

import { NextResponse } from 'next/server';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';
import { estimateTdee } from '@/lib/tdee';

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const weightLogs  = Array.isArray(b.weightLogs)  ? b.weightLogs  : [];
  const calorieLogs = Array.isArray(b.calorieLogs) ? b.calorieLogs : [];

  // Fetch the most recent previous estimate for smoothing
  const supabase = await createServerSupabase();
  const { data: prevRow } = await supabase
    .from('tdee_estimates')
    .select('tdee_kcal')
    .eq('user_id', user.id)
    .order('estimated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = estimateTdee({
    weightLogs:  weightLogs  as Array<{ date: string; weightKg: number }>,
    calorieLogs: calorieLogs as Array<{ date: string; totalKcal: number }>,
    prevTdee:    prevRow?.tdee_kcal ?? null,
    weightKg:    typeof b.weightKg  === 'number' ? b.weightKg  : null,
    heightCm:    typeof b.heightCm  === 'number' ? b.heightCm  : null,
    age:         typeof b.age       === 'number' ? b.age       : null,
    sex:         (b.sex === 'male' || b.sex === 'female') ? b.sex : null,
  });

  const today = new Date().toISOString().slice(0, 10);

  if (result.tdeeKcal != null) {
    await supabase
      .from('tdee_estimates')
      .upsert({
        user_id:      user.id,
        estimated_at: today,
        tdee_kcal:    result.tdeeKcal,
        window_days:  14,
        r_squared:    result.rSquared,
        data_points:  result.dataPoints,
      }, { onConflict: 'user_id,estimated_at' });
  }

  return NextResponse.json({ ...result, date: today });
}
