/**
 * GET /api/tdee/history
 *
 * Returns the last 30 TDEE estimates for the authenticated user, ordered
 * most-recent first. Used by the dashboard TDEE card to render trend charts.
 *
 * Response (200):
 *   Array<{ estimated_at: string, tdee_kcal: number, r_squared: number | null, data_points: number }>
 *
 * 401 — not authenticated
 */

import { NextResponse } from 'next/server';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';

export async function GET(): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('tdee_estimates')
    .select('estimated_at, tdee_kcal, r_squared, data_points')
    .eq('user_id', user.id)
    .order('estimated_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
