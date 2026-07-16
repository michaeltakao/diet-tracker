/**
 * Doctor-facing health report builder (期間指定) — pure and testable.
 *
 * Aggregates the user's self-logged data into typed sections for the /report
 * print page. Vitals get SUMMARY STATISTICS ONLY (min/median/max) — no
 * interpretation, thresholds, or verdicts anywhere. All dates are JST
 * calendar days (YYYY-MM-DD strings), range boundaries inclusive.
 */

import type { AppData, DailyCheckIn } from './types';

export interface ReportRange {
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
}

export interface SymptomReportRow {
  date: string;
  name: string;
  severity: number;
  durationMin?: number;
  trigger?: string;
  actionTaken?: string;
  relatedMealName?: string;
  relatedWorkoutName?: string;
}

export interface SeriesStats {
  count: number;
  min: number;
  median: number;
  max: number;
}

export interface HealthReport {
  range: ReportRange;
  symptoms: {
    rows: SymptomReportRow[];              // chronological
    countsByName: Array<{ name: string; count: number }>; // most frequent first
  };
  meals: {
    daysLogged: number;
    avgCalories: number | null;  // per logged day; null when no logged days
    avgProtein: number | null;
    avgFat: number | null;
    avgCarbs: number | null;
  };
  workouts: {
    sessions: number;
    sessionsByCategory: Array<{ category: string; count: number }>;
    totalMinutes: number;        // sum of entries that carry a duration
  };
  vitals: {
    bpRows: Array<{ date: string; systolic: number; diastolic: number }>;
    systolic: SeriesStats | null;
    diastolic: SeriesStats | null;
    glucoseByContext: Array<{ context: string; stats: SeriesStats }>;
  };
  weight: {
    series: Array<{ date: string; weight: number }>;
    deltaKg: number | null;      // last − first; null with <2 points
  };
  wellness: {
    avgSleepHours: number | null;
    avgSleepQuality: number | null;
    avgStressLevel: number | null;
    avgWaterMl: number | null;   // over days with water logged in range
  };
}

const inRange = (date: string, range: ReportRange): boolean =>
  date >= range.from && date <= range.to;

function stats(values: number[]): SeriesStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { count: sorted.length, min: sorted[0], median, max: sorted[sorted.length - 1] };
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

/**
 * Build the report for [range.from, range.to] (JST days, inclusive).
 * Check-ins live outside AppData, so they are passed separately.
 */
export function buildHealthReport(
  data: AppData,
  checkIns: DailyCheckIn[],
  range: ReportRange,
): HealthReport {
  // ── Symptoms ──
  const symptomRows = data.symptomEntries
    .filter((e) => inRange(e.date, range))
    .sort((a, b) => a.onsetAt.localeCompare(b.onsetAt))
    .map((e) => ({
      date: e.date,
      name: e.name,
      severity: e.severity,
      durationMin: e.durationMin,
      trigger: e.trigger,
      actionTaken: e.actionTaken,
      relatedMealName: e.relatedMealName,
      relatedWorkoutName: e.relatedWorkoutName,
    }));
  const nameCounts = new Map<string, number>();
  for (const r of symptomRows) nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);
  const countsByName = [...nameCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // ── Meals: averages over DAYS WITH LOGS only (empty days don't dilute) ──
  const foodInRange = data.foodEntries.filter((e) => inRange(e.date, range));
  const byDay = new Map<string, { kcal: number; p: number; f: number; c: number }>();
  for (const e of foodInRange) {
    const d = byDay.get(e.date) ?? { kcal: 0, p: 0, f: 0, c: 0 };
    d.kcal += e.calories; d.p += e.protein; d.f += e.fat; d.c += e.carbs;
    byDay.set(e.date, d);
  }
  const dayTotals = [...byDay.values()];
  const meals = {
    daysLogged: dayTotals.length,
    avgCalories: avg(dayTotals.map((d) => d.kcal)),
    avgProtein:  avg(dayTotals.map((d) => d.p)),
    avgFat:      avg(dayTotals.map((d) => d.f)),
    avgCarbs:    avg(dayTotals.map((d) => d.c)),
  };

  // ── Workouts ──
  const workoutsInRange = data.workoutEntries.filter((e) => inRange(e.date, range));
  const catCounts = new Map<string, number>();
  for (const w of workoutsInRange) catCounts.set(w.category, (catCounts.get(w.category) ?? 0) + 1);
  const workouts = {
    sessions: workoutsInRange.length,
    sessionsByCategory: [...catCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    totalMinutes: workoutsInRange.reduce((s, w) => s + (w.duration ?? 0), 0),
  };

  // ── Vitals: summary statistics only — record, never interpret ──
  const vitalsInRange = data.vitalEntries.filter((e) => inRange(e.date, range));
  const bp = vitalsInRange.filter((v) => v.kind === 'blood_pressure');
  const glucose = vitalsInRange.filter((v) => v.kind === 'blood_glucose');
  const glucoseContexts = [...new Set(glucose.map((g) => g.glucoseContext))].sort();
  const vitals = {
    bpRows: bp
      .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
      .map((v) => ({ date: v.date, systolic: v.systolic, diastolic: v.diastolic })),
    systolic:  stats(bp.map((v) => v.systolic)),
    diastolic: stats(bp.map((v) => v.diastolic)),
    glucoseByContext: glucoseContexts.flatMap((context) => {
      const s = stats(glucose.filter((g) => g.glucoseContext === context).map((g) => g.glucoseMgDl));
      return s ? [{ context, stats: s }] : [];
    }),
  };

  // ── Weight ──
  const weightSeries = data.weightEntries
    .filter((e) => inRange(e.date, range))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, weight: e.weight }));
  const weight = {
    series: weightSeries,
    deltaKg: weightSeries.length >= 2
      ? Math.round((weightSeries[weightSeries.length - 1].weight - weightSeries[0].weight) * 10) / 10
      : null,
  };

  // ── Wellness (check-ins + water) ──
  const checkInsInRange = checkIns.filter((c) => inRange(c.date, range));
  const waterInRange = Object.entries(data.waterByDate)
    .filter(([date, ml]) => inRange(date, range) && ml > 0)
    .map(([, ml]) => ml);
  const wellness = {
    avgSleepHours:   avg(checkInsInRange.map((c) => c.sleepHours)),
    avgSleepQuality: avg(checkInsInRange.flatMap((c) => (c.sleepQuality != null ? [c.sleepQuality] : []))),
    avgStressLevel:  avg(checkInsInRange.flatMap((c) => (c.stressLevel != null ? [c.stressLevel] : []))),
    avgWaterMl:      avg(waterInRange),
  };

  return {
    range,
    symptoms: { rows: symptomRows, countsByName },
    meals,
    workouts,
    vitals,
    weight,
    wellness,
  };
}
