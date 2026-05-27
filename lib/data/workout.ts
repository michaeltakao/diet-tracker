/**
 * Workout data access layer.
 *
 * Currently delegates to lib/storage.ts (localStorage).
 * STEP 6: replace internals with Supabase queries when user is authenticated.
 */

import {
  addWorkoutEntry as _add,
  removeWorkoutEntry as _remove,
  getWorkoutsForDate as _getByDate,
  getAppData as _getAll,
  checkAndUpdatePR as _checkPR,
  getPersonalRecord as _getPR,
} from '@/lib/storage';
import type { WorkoutEntry, PersonalRecord } from '@/lib/types';

// ── Read ──────────────────────────────────────────────────────

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

// ── Write ─────────────────────────────────────────────────────

export function addWorkoutEntry(entry: WorkoutEntry): void {
  _add(entry);
}

export function removeWorkoutEntry(id: string): void {
  _remove(id);
}

/**
 * Check and update PR for an exercise.
 * @returns true if this is a new PR.
 */
export function checkAndUpdatePR(
  exerciseName: string,
  weight: number,
  date: string,
): boolean {
  return _checkPR(exerciseName, weight, date);
}
