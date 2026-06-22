/**
 * GET /api/research/participants
 *
 * Researcher-only endpoint. Returns a list of all study participants with
 * engagement metrics. Requires profiles.role = 'researcher'.
 *
 * Response (200):
 *   Array<ParticipantSummary>
 *
 * 401 — not authenticated
 * 403 — not a researcher
 */

import { NextResponse } from 'next/server';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';

export interface ParticipantSummary {
  id:                string;
  display_name:      string | null;
  consented_at:      string | null;
  study_cohort:      string | null;
  last_food_log:     string | null;   // YYYY-MM-DD
  food_log_count:    number;
  weight_log_count:  number;
  accept_count:      number;
  reject_count:      number;
  favorite_count:    number;
}

export async function GET(): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServerSupabase();

  // Role check
  const { data: self } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (self?.role !== 'researcher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all consented participants
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name, consented_at, study_cohort, role')
    .eq('role', 'participant')
    .not('consented_at', 'is', null)
    .order('consented_at', { ascending: false });

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json([]);
  }

  const userIds = profiles.map(p => p.id);

  // Parallel fetch engagement data
  const [foodRes, weightRes, fbRes] = await Promise.all([
    supabase
      .from('food_logs')
      .select('user_id, logged_date')
      .in('user_id', userIds),
    supabase
      .from('weight_logs')
      .select('user_id')
      .in('user_id', userIds),
    supabase
      .from('recommendation_feedback')
      .select('user_id, kind')
      .in('user_id', userIds),
  ]);

  // Aggregate by user_id
  const foodByUser    = new Map<string, { count: number; latest: string }>();
  const weightByUser  = new Map<string, number>();
  const fbByUser      = new Map<string, { accept: number; reject: number; favorite: number }>();

  for (const row of foodRes.data ?? []) {
    const existing = foodByUser.get(row.user_id);
    if (!existing) {
      foodByUser.set(row.user_id, { count: 1, latest: row.logged_date });
    } else {
      existing.count++;
      if (row.logged_date > existing.latest) existing.latest = row.logged_date;
    }
  }

  for (const row of weightRes.data ?? []) {
    weightByUser.set(row.user_id, (weightByUser.get(row.user_id) ?? 0) + 1);
  }

  for (const row of fbRes.data ?? []) {
    const entry = fbByUser.get(row.user_id) ?? { accept: 0, reject: 0, favorite: 0 };
    if (row.kind === 'accept')   entry.accept++;
    if (row.kind === 'reject')   entry.reject++;
    if (row.kind === 'favorite') entry.favorite++;
    fbByUser.set(row.user_id, entry);
  }

  const result: ParticipantSummary[] = profiles.map(p => {
    const food = foodByUser.get(p.id);
    const fb   = fbByUser.get(p.id) ?? { accept: 0, reject: 0, favorite: 0 };
    return {
      id:               p.id,
      display_name:     p.display_name,
      consented_at:     p.consented_at,
      study_cohort:     p.study_cohort,
      last_food_log:    food?.latest ?? null,
      food_log_count:   food?.count  ?? 0,
      weight_log_count: weightByUser.get(p.id) ?? 0,
      accept_count:     fb.accept,
      reject_count:     fb.reject,
      favorite_count:   fb.favorite,
    };
  });

  return NextResponse.json(result);
}
