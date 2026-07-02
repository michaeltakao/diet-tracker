/**
 * One-rep-max (1RM) estimation.
 *
 * Uses the Epley formula, the same model popularised by training apps like
 * 筋トレMEMO:  1RM = w · (1 + reps / 30)
 *
 * The estimate is only meaningful for low-to-moderate rep ranges (≈ 1–15);
 * accuracy degrades for very high reps, which is inherent to all 1RM formulas.
 */

/**
 * Estimate one-rep max from a working set.
 *
 * @param weight - Load lifted, in kg (or any unit; result is in the same unit).
 * @param reps   - Repetitions completed at that load.
 * @returns Estimated 1RM, rounded to 0.1. Returns 0 for non-positive input.
 */
export function epley1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  // A single rep is already a 1RM by definition.
  const estimate = reps === 1 ? weight : weight * (1 + reps / 30);
  return Math.round(estimate * 10) / 10;
}

/**
 * Best estimated 1RM across a collection of sets.
 *
 * @param sets - Sets with weight (kg) and reps.
 * @returns The highest Epley estimate, rounded to 0.1; 0 if no qualifying sets.
 */
export function best1RM(sets: ReadonlyArray<{ weight: number; reps: number }>): number {
  return sets.reduce((max, s) => Math.max(max, epley1RM(s.weight, s.reps)), 0);
}
