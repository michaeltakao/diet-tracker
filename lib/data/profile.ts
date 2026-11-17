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
import { capGoalsForConditions } from '@/lib/medication-rules';
import { getOnboardingRecord } from './onboarding';
import { getHealthProfile } from './health-profile';
import { getLatestWeightEntry } from './weight';
import type { DailyGoals } from '@/lib/types';

// ── Read ──────────────────────────────────────────────────────

/**
 * Current daily goals, exactly as stored (uncapped). Only the settings form
 * should read this — it edits the stored value. Everything that displays or
 * sends goals uses getRealGoals(), which applies condition caps.
 */
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
  if (!(onboarded || !goalsEqualDefaults(goals))) return null;
  // Read-time condition caps (2026-11-17): a CKD user's stored protein goal
  // may exceed 0.8 g/kg; every consumer (rings, Trends, all AI routes) gets
  // min(goal, cap). Stored data is never rewritten.
  return capGoalsForConditions(
    goals,
    getHealthProfile().healthConditions ?? [],
    getLatestWeightEntry()?.weight ?? null,
  );
}

// ── Write ─────────────────────────────────────────────────────

/** Persist updated daily goals. */
export function updateGoals(goals: DailyGoals): void {
  _updateGoals(goals);
}
