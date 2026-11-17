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
} from '@/lib/storage';
import { write as outboxWrite, type RowFor } from './outbox';
import type { WorkoutEntry } from '@/lib/types';
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

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/** Supabase row for a workout entry (user_id and build stamp added by the outbox). */
export function workoutRow(entry: WorkoutEntry): RowFor<'workout_logs'> {
  return {
    id:           entry.id,
    logged_date:  entry.date,
    name:         entry.name,
    category:     entry.category as WorkoutCatEnum,
    muscle_part:  (entry.musclePart as MusclePartEnum | undefined) ?? null,
    sets:         entry.sets ?? null,
    reps:         entry.reps ?? null,
    weight_kg:    entry.weight ?? null,
    duration_min: entry.duration ?? null,
    notes:        entry.notes ?? null,
    set_details:  entry.setDetails?.map((s) => ({ weight: s.weight, reps: s.reps })) ?? null,
    logged_at:    entry.addedAt,
  };
}

export async function addWorkoutEntry(entry: WorkoutEntry): Promise<void> {
  // Step 1: localStorage
  _add(entry);
  // Step 2: outbox → Supabase (ADR-008 P0-6)
  await outboxWrite({ kind: 'upsert', table: 'workout_logs', row: workoutRow(entry), onConflict: 'id' });
}

export async function removeWorkoutEntry(id: string): Promise<void> {
  // Step 1: localStorage
  _remove(id);
  // Step 2: queued delete (cancels a still-queued upsert of the same row)
  await outboxWrite({ kind: 'delete', table: 'workout_logs', id });
}
