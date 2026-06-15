/**
 * Pure helpers bridging an active training program's planned session to the
 * tap-to-log workout editor.
 *
 * Kept free of React, DOM, and `Date.now()` so they are deterministic and unit
 * testable. The workout page wires them to live state.
 */

import type { PlannedExercise } from '@/lib/types';

/** Catalog-shaped defaults ready to hand to `resolveInitialSetValues`. */
export interface PlannedDefaults {
  /** Starting load in kg (0 = bodyweight / unknown). */
  defaultWeight: number;
  /** Starting repetitions (the conservative low end of the planned range). */
  defaultReps: number;
  /** Starting set count. */
  defaultSets: number;
}

/**
 * Translate a planned exercise into set-editor defaults.
 *
 * Weight precedence: the plan's explicit `targetWeight`, then the catalog
 * fallback for a name match, then 0 (bodyweight or an exercise the catalog does
 * not know). Reps default to `repsMin` — the conservative start of the planned
 * `repsMin`–`repsMax` range — and sets come straight from the plan. The shape
 * matches {@link resolveInitialSetValues}, so a logged history still overrides
 * these via progressive overload.
 *
 * @param pe - Planned exercise from the active program (only the fields used
 *             for prefill are required).
 * @param catalogWeight - Catalog `defaultWeight` (kg) for a name match, if any.
 * @returns Defaults shaped for {@link resolveInitialSetValues}.
 */
export function plannedExerciseDefaults(
  pe: Pick<PlannedExercise, 'sets' | 'repsMin' | 'targetWeight'>,
  catalogWeight?: number,
): PlannedDefaults {
  return {
    defaultWeight: pe.targetWeight ?? catalogWeight ?? 0,
    defaultReps: pe.repsMin,
    defaultSets: pe.sets,
  };
}

/** Per-exercise completion state for a planned session. */
export interface SessionProgress {
  /** name → logged-today flag (true once any matching entry exists). */
  doneByName: Record<string, boolean>;
  /** Count of distinct planned exercises logged today. */
  doneCount: number;
  /** Number of distinct planned exercises in the session. */
  total: number;
  /** True when every planned exercise has been logged today. */
  complete: boolean;
}

/**
 * Match a session's planned exercises against today's logged names.
 *
 * Matching is by exact name. Duplicate planned names collapse to a single slot,
 * so `doneCount`/`total` count distinct names and a repeated name is never
 * double-counted. An exercise with no matching log is reported as not done; an
 * empty session is reported as not complete.
 *
 * @param exerciseNames - Planned exercise names for the selected session
 *                        (duplicates allowed; collapsed internally).
 * @param todaysNames - Names logged today (any order, duplicates allowed).
 * @returns Completion flags, counts, and an all-done flag.
 *
 * @remarks O(P + L) for P planned names and L logged names.
 */
export function getSessionProgress(
  exerciseNames: readonly string[],
  todaysNames: readonly string[],
): SessionProgress {
  const logged = new Set(todaysNames);
  const distinct = [...new Set(exerciseNames)];
  const doneByName: Record<string, boolean> = {};
  let doneCount = 0;
  for (const name of distinct) {
    const done = logged.has(name);
    doneByName[name] = done;
    if (done) doneCount += 1;
  }
  const total = distinct.length;
  return { doneByName, doneCount, total, complete: total > 0 && doneCount === total };
}
