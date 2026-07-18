/**
 * Per-set workout math — pure functions (phase B).
 *
 * A per-set entry stores `setDetails: SetDetail[]`; the WorkoutEntry scalar
 * fields (weight/reps/sets) remain the canonical summary consumed by the
 * timeline, PR logic, and charts. summarizeSets() defines that mapping in
 * exactly one place: weight = top-set weight, reps = reps performed AT the
 * top weight (first such set), sets = count, volume = Σ weight×reps.
 */

import type { SetDetail } from '@/lib/types';
import { best1RM } from '@/lib/onerm';

export interface SetSummary {
  sets: number;
  /** Reps at the top weight (first set that reaches it). */
  reps: number;
  /** Top (max) weight across sets, kg. */
  weight: number;
  /** Total volume Σ weight×reps, kg. Bodyweight sets (weight 0) add 0. */
  volume: number;
  /** Best Epley estimate across sets (lib/onerm.ts), kg. */
  best1RM: number;
}

/** Keep only structurally valid sets (finite, non-negative, reps > 0). */
function validSets(setDetails: ReadonlyArray<SetDetail>): SetDetail[] {
  return setDetails.filter(
    (s) =>
      Number.isFinite(s.weight) && s.weight >= 0 &&
      Number.isFinite(s.reps) && s.reps > 0,
  );
}

/**
 * Summarize per-set details into the scalar WorkoutEntry fields.
 *
 * Returns an all-zero summary for an empty/invalid list — callers treat that
 * as "nothing to log".
 */
export function summarizeSets(setDetails: ReadonlyArray<SetDetail>): SetSummary {
  const sets = validSets(setDetails);
  if (sets.length === 0) return { sets: 0, reps: 0, weight: 0, volume: 0, best1RM: 0 };

  const weight = Math.max(...sets.map((s) => s.weight));
  const top = sets.find((s) => s.weight === weight)!;
  const volume = Math.round(sets.reduce((sum, s) => sum + s.weight * s.reps, 0) * 10) / 10;

  return { sets: sets.length, reps: top.reps, weight, volume, best1RM: best1RM(sets) };
}

/**
 * Progressive-overload ghost for the next set/session (same rule as the
 * workout page's historical suggestWeight): ≥ 12 reps at the previous
 * weight → +2.5 kg, else repeat the weight. No history → the fallback.
 */
export function nextSetSuggestion(
  prev: SetDetail | null,
  fallbackWeightKg = 0,
): { weight: number; reps: number } {
  if (!prev || prev.weight <= 0) return { weight: fallbackWeightKg, reps: prev?.reps ?? 10 };
  return { weight: prev.reps >= 12 ? prev.weight + 2.5 : prev.weight, reps: prev.reps };
}
