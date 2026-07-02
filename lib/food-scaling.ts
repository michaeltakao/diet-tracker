/**
 * Portion scaling for food logging.
 *
 * Stored FoodEntry kcal/P/F/C are always FINAL consumed values; scaling
 * happens at entry time only. Rounding matches the add-page conventions:
 * calories to whole kcal, macros to 1 decimal.
 */

export interface ScalableFood {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sodiumMg?: number;
  fiberG?: number;
}

/** Allowed servings range — guards against typo inputs like 15 instead of 1.5. */
export const MIN_SERVINGS = 0.1;
export const MAX_SERVINGS = 10;

/** Clamp a servings value into [MIN_SERVINGS, MAX_SERVINGS]; NaN → 1. */
export function clampServings(servings: number): number {
  if (!Number.isFinite(servings)) return 1;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, servings));
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Scale a base portion's nutrition by a servings multiplier.
 *
 * Parameters
 * ----------
 * base     : per-portion nutrition values.
 * servings : multiplier, clamped to [MIN_SERVINGS, MAX_SERVINGS].
 *
 * Returns
 * -------
 * New object (input untouched): calories rounded to whole kcal, macros to
 * 1 decimal — identical to manual-entry rounding so downstream consumers
 * (TDEE, reports, streaks) see consistent precision.
 */
export function scaleFood<T extends ScalableFood>(base: T, servings: number): T {
  const s = clampServings(servings);
  return {
    ...base,
    calories: Math.round(base.calories * s),
    protein: round1(base.protein * s),
    fat: round1(base.fat * s),
    carbs: round1(base.carbs * s),
    ...(base.sodiumMg != null ? { sodiumMg: Math.round(base.sodiumMg * s) } : {}),
    ...(base.fiberG != null ? { fiberG: round1(base.fiberG * s) } : {}),
  };
}
