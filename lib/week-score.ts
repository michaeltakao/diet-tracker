/**
 * Weekly-report "週スコア" (0–100), pure so it can be unit-tested.
 *
 * Weights: calories 30 / protein 25 / workouts 25 / water 10 / streak 10.
 * When `fluidNeutral` is true (CKD — see CKD_FLUID_GUIDANCE), the water term
 * is dropped and the remaining weights are rescaled by 1/0.90 so the score
 * still spans 0–100 and water intake can neither raise nor lower it.
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
}

const W = { cal: 0.30, prt: 0.25, wkt: 0.25, h2o: 0.10, stk: 0.10 } as const;

// Upper clamp only — identical to the pre-extraction route arithmetic.
const pct = (x: number): number => Math.min(x, 100);

export function computeWeekScore(i: WeekScoreInput): number {
  const cal = pct(i.calorieCompliance) * W.cal;
  const prt = pct((i.avgProtein / Math.max(i.proteinGoal, 1)) * 100) * W.prt;
  const wkt = pct((i.workoutDays / 4) * 100) * W.wkt;
  const stk = pct((i.streak / 7) * 100) * W.stk;
  if (i.fluidNeutral) {
    return Math.round((cal + prt + wkt + stk) / (1 - W.h2o));
  }
  const h2o = pct((i.waterGoalDays / Math.max(i.loggedDays, 1)) * 100) * W.h2o;
  return Math.round(cal + prt + wkt + h2o + stk);
}
