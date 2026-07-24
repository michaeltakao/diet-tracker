/**
 * Per-exercise strength rank persistence (Liftoff-inspired, lib/exercise-rank.ts).
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async, fire-and-forget).
 * Follows the exact dual-write pattern used across lib/data/*.ts (see
 * checkAndUpdatePR in lib/data/workout.ts) — never throws, Supabase errors
 * are console.warn'd and swallowed (localStorage is the source of truth).
 */

import {
  getExerciseRankState as _get,
  setExerciseRankState as _set,
} from '@/lib/storage';
import { getExerciseRank, isRankableExercise, isExerciseRankHigher, type ExerciseRankId } from '@/lib/exercise-rank';
import { getLatestWeightEntry } from './weight';
import { getHealthProfile } from './health-profile';
import { getWriteContext } from './_write';
import type { ExerciseRankState } from '@/lib/types';

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

/** Currently stored rank for an exercise, or undefined if never achieved/not rankable. */
export function getExerciseRankState(exerciseId: string): ExerciseRankState | undefined {
  return _get(exerciseId);
}

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/**
 * Recompute an exercise's rank from a freshly-logged 1RM + the user's
 * latest bodyweight/sex, and persist it if the tier changed.
 *
 * Call this immediately after checkAndUpdatePR resolves in the workout
 * submit flow — same insertion point as the existing PR celebration.
 *
 * Returns `{ oldRank, newRank }` so the caller can decide whether to fire a
 * rank-up celebration (newRank !== oldRank && newRank !== 'unranked').
 * Returns null when `exerciseId` isn't one of the 10 curated rankable
 * lifts — not an error, just "this exercise has no rank system".
 *
 * Ratchet semantics mirror personal_records: a lower/equal ratio than an
 * already-achieved tier never downgrades or re-persists (no-op write).
 */
export async function recomputeAndPersistExerciseRank(
  exerciseId: string,
  est1RM: number,
): Promise<{ oldRank: ExerciseRankId; newRank: ExerciseRankId } | null> {
  if (!isRankableExercise(exerciseId)) return null;

  const bodyweight = getLatestWeightEntry()?.weight ?? null;
  const profile = getHealthProfile();
  const progress = getExerciseRank(exerciseId, est1RM, bodyweight, profile.sex ?? null);
  // isRankableExercise already confirmed exerciseId is in the threshold
  // table, so getExerciseRank cannot return null here.
  const newRank = progress!.rank;

  const existing = _get(exerciseId);
  const oldRank: ExerciseRankId = existing?.rank ?? 'unranked';

  // Ratchet: only ever move up. A session with a lower relative 1RM than
  // the already-achieved tier (e.g. a lighter warm-up-only day) must not
  // downgrade or re-persist — same "no row = not yet achieved, once
  // achieved never revoked" semantics as personal_records/badges. The
  // newRank === 'unranked' check is redundant with isExerciseRankHigher
  // (unranked is never higher than anything) but narrows the type for the
  // _set call below, which only accepts the 5 real tiers.
  if (newRank === 'unranked' || !isExerciseRankHigher(newRank, oldRank)) {
    return { oldRank, newRank: oldRank };
  }

  // Step 1: localStorage (synchronous)
  _set(exerciseId, newRank);

  // Step 2: Supabase — best-effort upsert, never blocks/throws for the caller
  const ctx = await getWriteContext();
  if (ctx) {
    const { error } = await ctx.supabase.from('exercise_ranks').upsert({
      user_id:     ctx.userId,
      exercise_id: exerciseId,
      rank:        newRank,
    }, { onConflict: 'user_id,exercise_id' });

    if (error) {
      console.warn('[data/exercise-rank] Supabase upsert failed:', error.message);
    }
  }

  return { oldRank, newRank };
}
