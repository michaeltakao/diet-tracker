/**
 * Weekly-report "週スコア" (0–100), pure so it can be unit-tested.
 *
 * Weights: calories 30 / protein 25 / workouts 25 / water 10 / streak 10.
 * When `fluidNeutral` is true (CKD — see CKD_FLUID_GUIDANCE), the water term
 * is dropped and the remaining weights are rescaled by 1/0.90 so the score
 * still spans 0–100 and water intake can neither raise nor lower it.
 *
 * When `proteinCapped` is true (CKD — see CKD_PROTEIN_G_PER_KG), protein is
 * scored against target = min(goal, cap): proportional credit up to target,
 * full credit from target to cap, and 0 above cap (over-limit intake is never
 * rewarded). With no cap (weight unknown) the protein term is dropped and the
 * rest rescaled the same way (CKD with water dropped too: ÷0.65).
 */

export interface WeekScoreInput {
  /** % of logged days within ±200 kcal of the goal (0–100). */
  calorieCompliance: number;
  avgProtein: number;
  proteinGoal: number;
  workoutDays: number;
  /** Logged days on which the water goal was met. */
  waterGoalDays: number;
  /** Days with at least one meal logged (> 0). */
  loggedDays: number;
  streak: number;
  /** CKD: water must not count toward the score. */
  fluidNeutral: boolean;
  /** CKD: protein is scored against the renal cap, never above it. */
  proteinCapped: boolean;
  /** Daily CKD protein cap in g; null = weight unknown. Ignored unless capped. */
  proteinCapG: number | null;
}

const W = { cal: 0.30, prt: 0.25, wkt: 0.25, h2o: 0.10, stk: 0.10 } as const;

// Upper clamp only — identical to the pre-extraction route arithmetic.
const pct = (x: number): number => Math.min(x, 100);

/** Protein credit 0–100, or null when the term is dropped from the score. */
function proteinCredit(i: WeekScoreInput): number | null {
  if (!i.proteinCapped) return pct((i.avgProtein / Math.max(i.proteinGoal, 1)) * 100);
  if (i.proteinCapG == null) return null;
  if (i.avgProtein > i.proteinCapG) return 0;
  const target = Math.min(i.proteinGoal, i.proteinCapG);
  return pct((i.avgProtein / Math.max(target, 1)) * 100);
}

export function computeWeekScore(i: WeekScoreInput): number {
  const cal = pct(i.calorieCompliance) * W.cal;
  const pc  = proteinCredit(i);
  const prt = pc == null ? 0 : pc * W.prt;
  const wkt = pct((i.workoutDays / 4) * 100) * W.wkt;
  const stk = pct((i.streak / 7) * 100) * W.stk;
  const h2o = i.fluidNeutral
    ? 0
    : pct((i.waterGoalDays / Math.max(i.loggedDays, 1)) * 100) * W.h2o;
  // Dropped terms leave the denominator; with nothing dropped `kept` is
  // exactly 1, so the non-CKD arithmetic is unchanged.
  const kept = 1 - (i.fluidNeutral ? W.h2o : 0) - (pc == null ? W.prt : 0);
  return Math.round((cal + prt + wkt + h2o + stk) / kept);
}
