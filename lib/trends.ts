/**
 * Trend analytics for the /log trends view (Phase C research surface).
 *
 * All functions are pure and deterministic: date strings in, plain data out.
 * No Date.now() — callers pass the date axis explicitly so results are
 * reproducible in tests and exports.
 *
 * Conventions:
 *   - Dates are YYYY-MM-DD strings; day arithmetic uses Date.parse of the
 *     bare string, which is UTC midnight per ECMA-262 — no local-TZ drift.
 *   - Weight: kilograms. Energy: kcal/day.
 *   - Adherence tolerance ±200 kcal matches WeeklyReport.calorieAdherence
 *     (lib/types.ts) and /api/weekly-report so the numbers agree everywhere.
 */

import { expSmooth, ols } from './tdee';
import type { WeightTrend } from './types';

/** ±kcal window counted as "on target" — keep in sync with /api/weekly-report. */
export const ADHERENCE_TOLERANCE_KCAL = 200;

/** Smoothing factor for the weight trend line (heavier than TDEE's 0.3 —
 *  daily scale weight is noisy from water/glycogen; 0.25 tracks the
 *  literature-standard "trend weight" EWMA range 0.1–0.3). */
export const WEIGHT_SMOOTH_ALPHA = 0.25;

/** Day index of an ISO date relative to an epoch date (both YYYY-MM-DD). */
function dayIndex(date: string, epoch: string): number {
  return Math.round((Date.parse(date) - Date.parse(epoch)) / 86_400_000);
}

// ── Weight smoothing ──────────────────────────────────────────────────────────

export interface SmoothedWeightPoint {
  date: string;
  /** Measured weight (kg). */
  raw: number;
  /** Exponentially smoothed trend weight (kg), rounded to 2 decimals. */
  smoothed: number;
}

/**
 * Exponentially smoothed "trend weight" series.
 *
 * Parameters
 * ----------
 * entries : (date, weightKg) pairs in any order; duplicates by date keep the
 *           last occurrence after sorting.
 * alpha   : EWMA factor (default WEIGHT_SMOOTH_ALPHA).
 *
 * Returns
 * -------
 * Date-ascending series with raw and smoothed values. Empty input → [].
 */
export function smoothWeightSeries(
  entries: ReadonlyArray<{ date: string; weight: number }>,
  alpha: number = WEIGHT_SMOOTH_ALPHA,
): SmoothedWeightPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out: SmoothedWeightPoint[] = [];
  let prev: number | null = null;
  for (const e of sorted) {
    const smoothed = expSmooth(prev, e.weight, alpha);
    prev = smoothed;
    out.push({ date: e.date, raw: e.weight, smoothed: Math.round(smoothed * 100) / 100 });
  }
  return out;
}

// ── Goal projection ───────────────────────────────────────────────────────────

/** Projections further out than this are shown as "no realistic ETA". */
export const MAX_PROJECTION_DAYS = 365;

/**
 * OLS weight trend + goal-date projection (implements the WeightTrend type).
 *
 * Regression runs on the smoothed series (raw daily weights are dominated by
 * water noise). Assumption: linear trend over the window — valid for the
 * 2–8-week horizons this view shows, not for long plateaus.
 *
 * Parameters
 * ----------
 * entries    : (date, weightKg) pairs, any order.
 * goalWeight : target weight (kg) or null/undefined when the user has no goal.
 * windowDays : trailing regression window (default 30).
 *
 * Returns
 * -------
 * WeightTrend, or null when fewer than 3 points are available (slope would be
 * meaningless). projectedGoalDate is null when: no goal, slope ~0, the trend
 * moves away from the goal, or the ETA exceeds MAX_PROJECTION_DAYS.
 */
export function projectGoalDate(
  entries: ReadonlyArray<{ date: string; weight: number }>,
  goalWeight: number | null | undefined,
  windowDays = 30,
): WeightTrend | null {
  const smoothed = smoothWeightSeries(entries);
  if (smoothed.length < 3) return null;

  const lastDate = smoothed[smoothed.length - 1].date;
  const window = smoothed.filter(p => dayIndex(lastDate, p.date) < windowDays);
  if (window.length < 3) return null;

  const epoch = window[0].date;
  const xs = window.map(p => dayIndex(p.date, epoch));
  const ys = window.map(p => p.smoothed);
  const { slope } = ols(xs, ys);

  const last = window[window.length - 1];
  const predictedIn30Days = Math.round((last.smoothed + slope * 30) * 10) / 10;

  let projectedGoalDate: string | null = null;
  if (goalWeight != null && Math.abs(slope) >= 1e-4) {
    const remaining = goalWeight - last.smoothed; // signed kg still to travel
    const days = remaining / slope;               // >0 only if trend points at the goal
    if (days > 0 && days <= MAX_PROJECTION_DAYS) {
      const target = new Date(Date.parse(last.date) + Math.ceil(days) * 86_400_000);
      projectedGoalDate = target.toISOString().slice(0, 10);
    }
  }

  return {
    slope: Math.round(slope * 10000) / 10000,
    predictedIn30Days,
    projectedGoalDate,
  };
}

// ── Intake vs expenditure ─────────────────────────────────────────────────────

export interface DailyBalancePoint {
  date: string;
  /** Total logged intake (kcal); null = nothing logged that day. */
  intakeKcal: number | null;
  /** TDEE estimate in force on that date (carried forward); null = none yet. */
  expenditureKcal: number | null;
  /** intake − expenditure; null when either side is missing. */
  balanceKcal: number | null;
}

/**
 * Daily energy balance over an explicit date axis.
 *
 * TDEE estimates are sparse (one per estimation day), so each axis date uses
 * the most recent estimate at or before it (step-function carry-forward).
 *
 * Parameters
 * ----------
 * dates       : the axis, date-ascending (e.g. last 14 days).
 * calorieLogs : (date, totalKcal) daily intake sums.
 * tdeeHistory : (date, tdeeKcal) estimates, any order.
 */
export function computeDailyBalance(
  dates: readonly string[],
  calorieLogs: ReadonlyArray<{ date: string; totalKcal: number }>,
  tdeeHistory: ReadonlyArray<{ date: string; tdeeKcal: number }>,
): DailyBalancePoint[] {
  const intakeByDate = new Map(calorieLogs.map(c => [c.date, c.totalKcal]));
  const tdeeSorted = [...tdeeHistory].sort((a, b) => a.date.localeCompare(b.date));

  return dates.map(date => {
    const intakeKcal = intakeByDate.get(date) ?? null;
    let expenditureKcal: number | null = null;
    for (const t of tdeeSorted) {
      if (t.date <= date) expenditureKcal = t.tdeeKcal;
      else break;
    }
    const balanceKcal =
      intakeKcal != null && expenditureKcal != null
        ? Math.round(intakeKcal - expenditureKcal)
        : null;
    return { date, intakeKcal, expenditureKcal, balanceKcal };
  });
}

// ── Calorie adherence ─────────────────────────────────────────────────────────

export type AdherenceStatus = 'within' | 'over' | 'under' | 'noData';

export interface AdherenceSeries {
  perDay: Array<{ date: string; status: AdherenceStatus; kcal: number | null }>;
  /** % of *logged* days within ±ADHERENCE_TOLERANCE_KCAL of goal (0–100).
   *  Null when no day in the axis has data. */
  adherencePct: number | null;
  loggedDays: number;
}

/**
 * Per-day calorie adherence over an explicit date axis, using the same
 * ±200 kcal semantics as WeeklyReport.calorieAdherence.
 */
export function computeAdherenceSeries(
  dates: readonly string[],
  calorieLogs: ReadonlyArray<{ date: string; totalKcal: number }>,
  goalKcal: number,
  toleranceKcal: number = ADHERENCE_TOLERANCE_KCAL,
): AdherenceSeries {
  const intakeByDate = new Map(calorieLogs.map(c => [c.date, c.totalKcal]));
  const perDay = dates.map(date => {
    const kcal = intakeByDate.get(date) ?? null;
    let status: AdherenceStatus;
    if (kcal == null) status = 'noData';
    else if (kcal > goalKcal + toleranceKcal) status = 'over';
    else if (kcal < goalKcal - toleranceKcal) status = 'under';
    else status = 'within';
    return { date, status, kcal };
  });

  const logged = perDay.filter(d => d.status !== 'noData');
  const within = logged.filter(d => d.status === 'within');
  return {
    perDay,
    adherencePct: logged.length > 0 ? Math.round((within.length / logged.length) * 100) : null,
    loggedDays: logged.length,
  };
}

// ── Macro shortfall ───────────────────────────────────────────────────────────

export interface MacroShortfall {
  /** Averages over logged days only (g/day, 1 decimal). Null = no logged days. */
  avgProtein: number | null;
  avgFat: number | null;
  avgCarbs: number | null;
  /** max(0, goal − avg): grams/day short of the goal (0 = met/exceeded). */
  proteinShortfallG: number;
  fatShortfallG: number;
  carbsShortfallG: number;
  loggedDays: number;
}

/**
 * Average macro intake vs goals over an explicit date axis.
 * "Shortfall" is only under-consumption — exceeding a macro goal reports 0
 * (over-consumption already shows in the calorie adherence view).
 */
export function computeMacroShortfall(
  dates: readonly string[],
  foodEntries: ReadonlyArray<{ date: string; protein: number; fat: number; carbs: number }>,
  goals: { protein: number; fat: number; carbs: number },
): MacroShortfall {
  const axis = new Set(dates);
  const byDate = new Map<string, { protein: number; fat: number; carbs: number }>();
  for (const e of foodEntries) {
    if (!axis.has(e.date)) continue;
    const d = byDate.get(e.date) ?? { protein: 0, fat: 0, carbs: 0 };
    d.protein += e.protein;
    d.fat += e.fat;
    d.carbs += e.carbs;
    byDate.set(e.date, d);
  }

  const days = [...byDate.values()];
  if (days.length === 0) {
    return {
      avgProtein: null, avgFat: null, avgCarbs: null,
      proteinShortfallG: 0, fatShortfallG: 0, carbsShortfallG: 0,
      loggedDays: 0,
    };
  }

  const avg = (sel: (d: { protein: number; fat: number; carbs: number }) => number) =>
    Math.round((days.reduce((s, d) => s + sel(d), 0) / days.length) * 10) / 10;

  const avgProtein = avg(d => d.protein);
  const avgFat = avg(d => d.fat);
  const avgCarbs = avg(d => d.carbs);

  const short = (goal: number, a: number) => Math.max(0, Math.round((goal - a) * 10) / 10);

  return {
    avgProtein, avgFat, avgCarbs,
    proteinShortfallG: short(goals.protein, avgProtein),
    fatShortfallG: short(goals.fat, avgFat),
    carbsShortfallG: short(goals.carbs, avgCarbs),
    loggedDays: days.length,
  };
}

// ── Axis helper ───────────────────────────────────────────────────────────────

/** Date-ascending axis of the `n` days ending at `endDate` (inclusive). */
export function lastNDates(endDate: string, n: number): string[] {
  const end = Date.parse(endDate);
  return Array.from({ length: n }, (_, i) =>
    new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}
