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
} from '@/lib/storage';
import type { DailyGoals } from '@/lib/types';

// ── Read ──────────────────────────────────────────────────────

/** Current daily goals. */
export function getGoals(): DailyGoals {
  return _getAll().goals;
}

// ── Write ─────────────────────────────────────────────────────

/** Persist updated daily goals. */
export function updateGoals(goals: DailyGoals): void {
  _updateGoals(goals);
}
