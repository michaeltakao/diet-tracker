/**
 * Adaptive TDEE (Total Daily Energy Expenditure) estimation.
 *
 * Algorithm: rolling weighted ordinary-least-squares regression on weight
 * vs. date, combined with average calorie intake over the same window, to
 * back-calculate the user's actual TDEE.
 *
 * TDEE = avg_calories - (weight_slope_kg/day × 7700 kcal/kg)
 *
 * The 7700 kcal/kg factor is the standard energy-per-kg-body-fat assumption
 * (Fact: established value used in energy balance literature; see Hall 2012).
 * It is approximate; actual value varies ±10% with body composition.
 *
 * Limitations (Fact):
 *   - Requires ≥ MIN_DATA_POINTS days with both a weight AND calorie log.
 *   - Weight variance near zero (plateau) makes regression degenerate;
 *     falls back to Mifflin-St Jeor static formula.
 *   - Does not model thermic effect of food or NEAT variation.
 *   - 14-day window may be too short for slow metabolic adaptation.
 *
 * Coordinate conventions:
 *   - Weight: kilograms (kg)
 *   - Calories: kcal
 *   - Time: days (integer offset from window start)
 *   - TDEE output: kcal/day, rounded to 1 decimal place
 */

/** Minimum paired (weight + calorie) data points to attempt regression. */
export const MIN_DATA_POINTS = 7;

/** Energy density of body fat (kcal/kg). Assumption per Hall 2012. */
const KCAL_PER_KG = 7700;

/** Exponential smoothing factor for TDEE series (α). */
const SMOOTH_ALPHA = 0.3;

export interface TdeeInput {
  /** Array of (date, weightKg) pairs; date as YYYY-MM-DD string. */
  weightLogs:  Array<{ date: string; weightKg: number }>;
  /** Array of (date, totalKcal) pairs (sum of all food logs on that day). */
  calorieLogs: Array<{ date: string; totalKcal: number }>;
  /** Most recent previous TDEE estimate (kcal), for smoothing. Null if first estimate. */
  prevTdee:    number | null;
  /** Rolling window length in days (default 14). */
  windowDays?: number;
  /** Optional: user's weight in kg for Mifflin-St Jeor fallback. */
  weightKg?:   number | null;
  /** Optional: user's height in cm for Mifflin-St Jeor fallback. */
  heightCm?:   number | null;
  /** Optional: user's age in years for Mifflin-St Jeor fallback. */
  age?:        number | null;
  /** Optional: user's sex for Mifflin-St Jeor fallback ('male'|'female'). */
  sex?:        'male' | 'female' | null;
}

export interface TdeeResult {
  /** Estimated TDEE in kcal/day, smoothed. Null if insufficient data. */
  tdeeKcal:    number | null;
  /** OLS R² of the weight regression (0–1). Null if degenerate or fallback. */
  rSquared:    number | null;
  /** Number of paired data points used. */
  dataPoints:  number;
  /** Whether the result used the static Mifflin-St Jeor fallback. */
  isFallback:  boolean;
}

/**
 * Ordinary least-squares linear regression: y ~ a + b*x.
 *
 * Returns
 * -------
 * slope     : b (weight change per day in kg/day)
 * intercept : a
 * rSquared  : R² coefficient of determination (0–1)
 */
function ols(
  x: readonly number[],
  y: readonly number[],
): { slope: number; intercept: number; rSquared: number } {
  const n = x.length;
  const xMean = x.reduce((s, v) => s + v, 0) / n;
  const yMean = y.reduce((s, v) => s + v, 0) / n;

  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  if (sxx === 0) {
    // Degenerate: all x values identical (weight plateau)
    return { slope: 0, intercept: yMean, rSquared: 0 };
  }

  const slope     = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const rSquared  = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);

  return { slope, intercept, rSquared: Math.max(0, Math.min(1, rSquared)) };
}

/**
 * Mifflin-St Jeor BMR → TDEE static fallback.
 *
 * Used when regression data is insufficient or degenerate.
 * Activity multiplier 1.55 (moderately active) is applied.
 *
 * Returns null if required parameters are missing.
 */
function mifflinStJeorTdee(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
  age:      number | null | undefined,
  sex:      'male' | 'female' | null | undefined,
): number | null {
  if (!weightKg || !heightCm || !age || !sex) return null;
  const bmr =
    sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  return Math.round(bmr * 1.55 * 10) / 10;
}

/**
 * Estimate TDEE from rolling weight + calorie data.
 *
 * Parameters
 * ----------
 * input : TdeeInput — weight logs, calorie logs, optional previous estimate
 *
 * Returns
 * -------
 * TdeeResult — estimated TDEE, confidence metrics, data point count
 */
export function estimateTdee(input: TdeeInput): TdeeResult {
  const windowDays = input.windowDays ?? 14;

  // Cut to rolling window using date strings (lexicographic sort is safe for ISO dates)
  const sorted = [...input.weightLogs].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-windowDays);
  if (recent.length === 0) {
    return { tdeeKcal: null, rSquared: null, dataPoints: 0, isFallback: false };
  }

  const windowStart = recent[0].date;
  const windowEnd   = recent[recent.length - 1].date;

  // Build calorie lookup for the window
  const calMap = new Map<string, number>();
  for (const c of input.calorieLogs) {
    if (c.date >= windowStart && c.date <= windowEnd) {
      calMap.set(c.date, c.totalKcal);
    }
  }

  // Paired observations: days with both weight AND calorie data
  const paired: Array<{ dayIdx: number; weightKg: number; kcal: number }> = [];
  const epoch = new Date(windowStart).getTime();

  for (const w of recent) {
    const kcal = calMap.get(w.date);
    if (kcal == null) continue;
    const dayIdx = Math.round((new Date(w.date).getTime() - epoch) / 86_400_000);
    paired.push({ dayIdx, weightKg: w.weightKg, kcal });
  }

  const dataPoints = paired.length;

  if (dataPoints < MIN_DATA_POINTS) {
    // Insufficient data — try static fallback
    const fallback = mifflinStJeorTdee(input.weightKg, input.heightCm, input.age, input.sex);
    return { tdeeKcal: fallback, rSquared: null, dataPoints, isFallback: fallback != null };
  }

  const xs  = paired.map(p => p.dayIdx);
  const wts = paired.map(p => p.weightKg);
  const { slope, rSquared } = ols(xs, wts);

  const avgCalories = paired.reduce((s, p) => s + p.kcal, 0) / dataPoints;

  // TDEE = avg intake - caloric surplus implied by weight trend
  // Positive slope means weight gain → surplus → TDEE < intake
  const rawTdee = avgCalories - slope * KCAL_PER_KG;

  // Guard: degenerate regression (plateau) → fall back
  if (rSquared < 0.01 && Math.abs(slope) < 1e-4) {
    const fallback = mifflinStJeorTdee(input.weightKg, input.heightCm, input.age, input.sex)
      ?? rawTdee;
    return { tdeeKcal: Math.round(fallback * 10) / 10, rSquared, dataPoints, isFallback: true };
  }

  // Exponential smoothing with previous estimate
  const smoothed =
    input.prevTdee != null
      ? SMOOTH_ALPHA * rawTdee + (1 - SMOOTH_ALPHA) * input.prevTdee
      : rawTdee;

  // Physiological bounds: 800–6000 kcal/day
  const clamped = Math.max(800, Math.min(6000, smoothed));

  return {
    tdeeKcal:   Math.round(clamped * 10) / 10,
    rSquared:   Math.round(rSquared * 10000) / 10000,
    dataPoints,
    isFallback: false,
  };
}

/**
 * Human-readable confidence label derived from R².
 *
 * Returns
 * -------
 * '高' (R² ≥ 0.7), '中' (0.4–0.7), '低' (< 0.4), or '—' if unavailable.
 */
export function tdeeConfidenceLabel(rSquared: number | null): string {
  if (rSquared == null)    return '—';
  if (rSquared >= 0.70)    return '高';
  if (rSquared >= 0.40)    return '中';
  return '低';
}
