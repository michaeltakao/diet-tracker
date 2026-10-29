/**
 * Profile & goals data access layer.
 *
 * Reads come from lib/storage.ts (localStorage). updateGoals() dual-writes
 * the goal columns to the Supabase profiles row when authenticated.
 */

import {
  getAppData as _getAll,
  updateGoals as _updateGoals,
  goalsEqualDefaults,
} from '@/lib/storage';
import { getOnboardingRecord } from './onboarding';
import { getWriteContext } from './_write';
import { toGoalColumns } from './goal-history';
import type { DailyGoals } from '@/lib/types';

// ── Read ──────────────────────────────────────────────────────

/** Current daily goals. */
export function getGoals(): DailyGoals {
  return _getAll().goals;
}

/**
 * Goals only when the user has actually set them; null while they are
 * still the fabricated fresh-install defaults (2000/150/60/200/2000).
 *
 * "Real" = the onboarding wizard was completed (not skipped) — its goal
 * fan-out is an explicit user act even if the numbers land on the
 * defaults — OR the stored goals differ from the defaults (settings
 * edit). Consumers must treat null as "no goals yet": hide goal-colored
 * UI and gate AI features behind a set-goals CTA instead of sending
 * fabricated numbers to the LLM.
 */
export function getRealGoals(): DailyGoals | null {
  const goals = getGoals();
  const record = getOnboardingRecord();
  const onboarded = record !== null && !record.skipped;
  return onboarded || !goalsEqualDefaults(goals) ? goals : null;
}

// ── Write ─────────────────────────────────────────────────────

/**
 * Which goal columns of the profiles row a save may touch.
 * - 'all'       — Settings: the user saw and saved every field.
 * - 'nutrition' — onboarding with confirmed body data: it computes kcal/PFC
 *                 but never asks for a goal weight, so goal_weight_kg is left
 *                 alone (a re-run on a new device must not NULL it).
 * - 'none'      — onboarding on default body data: the targets are
 *                 placeholders and must not overwrite the server's goals.
 */
export type GoalServerScope = 'all' | 'nutrition' | 'none';

/**
 * Persist updated daily goals: localStorage first, then the profiles row
 * (fire-and-forget, authenticated users only).
 */
export function updateGoals(goals: DailyGoals, server: GoalServerScope = 'all'): void {
  _updateGoals(goals);
  if (server === 'none') return;

  void (async () => {
    const ctx = await getWriteContext();
    if (!ctx) return;
    const { goal_weight_kg, ...nutrition } = toGoalColumns(goals);
    const { error } = await ctx.supabase
      .from('profiles')
      .update(server === 'all' ? { ...nutrition, goal_weight_kg } : nutrition)
      .eq('id', ctx.userId);
    if (error) console.warn('[data/profile] Supabase goals update failed:', error.message);
  })();
}
