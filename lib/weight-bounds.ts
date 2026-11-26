/**
 * Accepted body-weight range in kg, shared by the home quick logger and
 * /weight (UX_AUDIT #10: home took 20–300, /weight anything > 0).
 */
export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 300;

export function isValidWeightKg(v: number): boolean {
  return Number.isFinite(v) && v >= MIN_WEIGHT_KG && v <= MAX_WEIGHT_KG;
}
