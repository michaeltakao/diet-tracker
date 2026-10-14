/**
 * Goal history — append-only snapshots of the user's goal in Supabase
 * (`goal_history`, migration 025).
 *
 * Why: `profiles` keeps only the current goal. The 6-month study needs the
 * goal a participant STARTED with (purpose + goal weight), which a later
 * settings save would overwrite.
 *
 * Server-only: there is no localStorage copy of the history. The one
 * localStorage key below remembers the last snapshot sent from this device so
 * an unchanged settings save does not add a row. Guests write nothing
 * (getWriteContext() is null).
 */

import type { DailyGoals, FitnessGoal } from '@/lib/types';
import { getWriteContext } from './_write';
import { getOnboardingRecord } from './onboarding';

const LAST_SNAPSHOT_KEY = 'diet-tracker-goal-snapshot';
const PURPOSE_CHOSEN_KEY = 'diet-tracker-purpose-chosen';

/** The goal columns of `profiles`, clamped to that table's CHECK constraints. */
export interface GoalColumns {
  goal_calories:  number;
  goal_protein_g: number;
  goal_fat_g:     number;
  goal_carbs_g:   number;
  goal_water_ml:  number;
  goal_weight_kg: number | null;
}

/** One `goal_history` row, minus the columns the database fills in. */
export interface GoalSnapshot {
  /** NULL = the user has never actively chosen a purpose (see isPurposeChosen). */
  fitness_goal:   FitnessGoal | null;
  goal_weight_kg: number | null;
  goal_calories:  number | null;
  goal_protein_g: number | null;
  goal_fat_g:     number | null;
  goal_carbs_g:   number | null;
}

const oneDecimal = (n: number): number => Number(n.toFixed(1));

/**
 * Map client goals to `profiles` columns. Non-numeric or out-of-range input
 * falls back to the app defaults (2000/150/60/200/2000), the same values
 * lib/storage.ts uses for a fresh install; a goal weight that is missing or
 * not positive becomes NULL (the column's CHECK is `> 0`).
 */
export function toGoalColumns(goals: DailyGoals): GoalColumns {
  const weight = Number(goals.goalWeight);
  return {
    goal_calories:  Math.max(1, Math.round(Number(goals.calories) || 2000)),
    goal_protein_g: Math.max(0, oneDecimal(Number(goals.protein) || 150)),
    goal_fat_g:     Math.max(0, oneDecimal(Number(goals.fat)     || 60)),
    goal_carbs_g:   Math.max(0, oneDecimal(Number(goals.carbs)   || 200)),
    goal_water_ml:  Math.max(1, Math.round(Number(goals.water) || 2000)),
    goal_weight_kg: Number.isFinite(weight) && weight > 0 ? oneDecimal(weight) : null,
  };
}

/**
 * Build a snapshot. `goals` is null when the caller has no real nutrition
 * targets (onboarding finished without computed targets) — the nutrition
 * columns are then NULL rather than the fabricated defaults.
 */
export function toGoalSnapshot(fitnessGoal: FitnessGoal | null, goals: DailyGoals | null): GoalSnapshot {
  if (!goals) {
    return {
      fitness_goal: fitnessGoal,
      goal_weight_kg: null, goal_calories: null,
      goal_protein_g: null, goal_fat_g: null, goal_carbs_g: null,
    };
  }
  const c = toGoalColumns(goals);
  return {
    fitness_goal:   fitnessGoal,
    goal_weight_kg: c.goal_weight_kg,
    goal_calories:  c.goal_calories,
    goal_protein_g: c.goal_protein_g,
    goal_fat_g:     c.goal_fat_g,
    goal_carbs_g:   c.goal_carbs_g,
  };
}

/**
 * True once the user has actively picked a purpose on this device: they
 * answered the onboarding goal question (did not skip it), or they tapped a
 * purpose in Settings and saved (markPurposeChosen). The stored
 * `fitnessGoal` defaults to 'maintenance', so without this check a user who
 * never chose would be recorded — and stratified — as "maintain".
 */
export function isPurposeChosen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(PURPOSE_CHOSEN_KEY) === '1') return true;
  } catch { /* fall through to the onboarding record */ }
  const record = getOnboardingRecord();
  return record !== null && !record.skipped && !record.answers.defaultedSteps.includes('goal');
}

/** Remember that the user picked a purpose in Settings. */
export function markPurposeChosen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PURPOSE_CHOSEN_KEY, '1');
  } catch { /* storage unavailable */ }
}

/**
 * Append a goal snapshot for the signed-in user. Call after onboarding
 * completes and after a settings save. Pass `fitnessGoal: null` when the
 * purpose was never actively chosen; a snapshot with neither a purpose nor
 * goals is not written.
 *
 * Skipped when it equals the last snapshot this device sent for the same
 * user. The marker is written only after a successful insert, so a failed
 * write is retried on the next save. Never throws.
 */
export async function recordGoalSnapshot(
  fitnessGoal: FitnessGoal | null,
  goals: DailyGoals | null,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (fitnessGoal === null && goals === null) return;
  const ctx = await getWriteContext();
  if (!ctx) return;

  const snapshot = toGoalSnapshot(fitnessGoal, goals);
  const marker = `${ctx.userId}:${JSON.stringify(snapshot)}`;
  try {
    if (localStorage.getItem(LAST_SNAPSHOT_KEY) === marker) return;
  } catch { /* storage unavailable — fall through and insert */ }

  const { error } = await ctx.supabase
    .from('goal_history')
    .insert({ user_id: ctx.userId, ...snapshot });
  if (error) {
    console.warn('[data/goal-history] Supabase insert failed:', error.message);
    return;
  }
  try {
    localStorage.setItem(LAST_SNAPSHOT_KEY, marker);
  } catch { /* storage unavailable — next save may add a duplicate row */ }
}
