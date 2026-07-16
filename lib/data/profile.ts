/**
 * Profile & goals data access layer.
 *
 * Currently delegates to lib/storage.ts (localStorage).
 * STEP 5: replaced with ProfileContext (Supabase Auth user + profile row).
 * STEP 6: update goals writes to Supabase profiles table.
 */

import {
  getAppData as _getAll,
  updateGoals as _updateGoals,
  goalsEqualDefaults,
} from '@/lib/storage';
import { getOnboardingRecord } from './onboarding';
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

/** Persist updated daily goals. */
export function updateGoals(goals: DailyGoals): void {
  _updateGoals(goals);
}
