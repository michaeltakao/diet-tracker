/**
 * Workout data access layer.
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async, fire-and-forget).
 *
 * STEP 6: dual-write added.
 * STEP 7: reads will prefer Supabase after migration runs.
 */

import {
  addWorkoutEntry    as _add,
  removeWorkoutEntry as _remove,
  getWorkoutsForDate as _getByDate,
  getAppData         as _getAll,
  checkAndUpdatePR   as _checkPR,
  getPersonalRecord  as _getPR,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { WorkoutEntry, PersonalRecord } from '@/lib/types';
import type { MusclePartEnum, WorkoutCatEnum } from '@/lib/database.types';

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

/** Workout entries for a specific date (YYYY-MM-DD). */
export function getWorkoutEntriesForDate(date: string): WorkoutEntry[] {
  return _getByDate(date);
}

/** All workout entries across all dates. */
export function getAllWorkoutEntries(): WorkoutEntry[] {
  return _getAll().workoutEntries;
}

/** Workout entries for a date range [startDate, endDate] inclusive. */
export function getWorkoutEntriesForRange(startDate: string, endDate: string): WorkoutEntry[] {
  return _getAll().workoutEntries.filter(
    (e) => e.date >= startDate && e.date <= endDate,
  );
}

/** Current personal record for an exercise. */
export function getPersonalRecord(exerciseName: string): PersonalRecord | undefined {
  return _getPR(exerciseName);
}

/** All personal records keyed by exercise name. */
export function getAllPersonalRecords(): Record<string, PersonalRecord> {
  return _getAll().personalRecords ?? {};
}

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

export async function addWorkoutEntry(entry: WorkoutEntry): Promise<void> {
  // Step 1: localStorage
  _add(entry);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('workout_logs').upsert({
    id:           entry.id,
    user_id:      ctx.userId,
    logged_date:  entry.date,
    name:         entry.name,
    category:     entry.category as WorkoutCatEnum,
    muscle_part:  (entry.musclePart as MusclePartEnum | undefined) ?? null,
    sets:         entry.sets ?? null,
    reps:         entry.reps ?? null,
    weight_kg:    entry.weight ?? null,
    duration_min: entry.duration ?? null,
    notes:        entry.notes ?? null,
    logged_at:    entry.addedAt,
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[data/workout] Supabase addWorkoutEntry failed:', error.message);
  }
}

export async function removeWorkoutEntry(id: string): Promise<void> {
  // Step 1: localStorage
  _remove(id);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase
    .from('workout_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId);

  if (error) {
    console.warn('[data/workout] Supabase removeWorkoutEntry failed:', error.message);
  }
}

/**
 * Check and update PR for an exercise.
 *
 * Returns true if this is a new PR.
 * localStorage update is synchronous; Supabase PR record is upserted async.
 */
export async function checkAndUpdatePR(
  exerciseName: string,
  weight: number,
  date: string,
): Promise<boolean> {
  // Step 1: localStorage PR check (synchronous)
  const isNewPR = _checkPR(exerciseName, weight, date);

  // Step 2: Supabase — upsert PR record if this is a new PR
  if (isNewPR) {
    const ctx = await getWriteContext();
    if (ctx) {
      const { error } = await ctx.supabase.from('personal_records').upsert({
        user_id:       ctx.userId,
        exercise_name: exerciseName,
        max_weight_kg: weight,
        achieved_date: date,
      }, { onConflict: 'user_id,exercise_name' });

      if (error) {
        console.warn('[data/workout] Supabase checkAndUpdatePR failed:', error.message);
      }
    }
  }

  return isNewPR;
}
