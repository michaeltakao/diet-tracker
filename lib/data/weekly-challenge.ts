/**
 * Weekly challenge data layer (FTUE roadmap 2026-07).
 *
 * One fixed, deterministic challenge: "log activity on N distinct days this
 * JST Mon–Sun week" — activity = any-log day (food / workout / weight /
 * water>0), the same union the streak uses.
 *
 * Progress is DERIVED live from the local entries on every read (never stored
 * client-side, so it can't drift), and mirrored to Supabase best-effort for
 * research capture — same dual-write pattern as badges.
 */

import { getActivityDays } from '@/lib/storage';
import { countActivityDaysInWeek, jstToday, shiftDate, weekStartOf } from '@/lib/streak';
import { getWriteContext } from './_write';

/** Fixed goal: distinct any-log days per week (no goal-selection UI). */
export const WEEKLY_GOAL_DAYS = 5;

export interface WeeklyChallenge {
  weekStart: string;     // JST Monday (YYYY-MM-DD)
  weekEnd: string;       // JST Sunday (YYYY-MM-DD)
  goalDays: number;
  progressDays: number;
  completed: boolean;
}

/** Derive the current JST-week challenge from local entries (synchronous). */
export function getCurrentWeeklyChallenge(): WeeklyChallenge {
  const weekStart = weekStartOf(jstToday());
  const progressDays = countActivityDaysInWeek(getActivityDays(), weekStart);
  return {
    weekStart,
    weekEnd: shiftDate(weekStart, 6),
    goalDays: WEEKLY_GOAL_DAYS,
    progressDays,
    completed: progressDays >= WEEKLY_GOAL_DAYS,
  };
}

/**
 * Recompute the current challenge and mirror it to Supabase (fire-and-forget
 * from the dashboard; no-op for guests). Preserves the first completion
 * timestamp across re-syncs.
 */
export async function syncWeeklyChallenge(): Promise<WeeklyChallenge> {
  const challenge = getCurrentWeeklyChallenge();

  const ctx = await getWriteContext();
  if (!ctx) return challenge;

  const { data: existing } = await ctx.supabase
    .from('weekly_challenges')
    .select('completed_at')
    .eq('user_id', ctx.userId)
    .eq('week_start', challenge.weekStart)
    .maybeSingle();

  const completedAt = challenge.completed
    ? existing?.completed_at ?? new Date().toISOString()
    : null;

  const { error } = await ctx.supabase.from('weekly_challenges').upsert(
    {
      user_id:       ctx.userId,
      week_start:    challenge.weekStart,
      goal_days:     challenge.goalDays,
      progress_days: challenge.progressDays,
      completed_at:  completedAt,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: 'user_id,week_start' },
  );
  if (error) {
    console.warn('[data/weekly-challenge] Supabase sync failed:', error.message);
  }
  return challenge;
}
