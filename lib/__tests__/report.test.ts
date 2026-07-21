import { describe, it, expect } from 'vitest';
import { buildHealthReport, type ReportRange } from '../report';
import type { AppData, DailyCheckIn } from '../types';

const RANGE: ReportRange = { from: '2026-07-01', to: '2026-07-14' };

function emptyData(): AppData {
  return {
    foodEntries: [],
    workoutEntries: [],
    weightEntries: [],
    goals: { calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 },
    waterByDate: {},
    badges: [],
    personalRecords: {},
    recommendationFeedback: [],
    favoriteFoods: [],
    mealTemplates: [],
    streakState: { longest: 0, repairedDates: [] },
    vitalEntries: [],
    symptomEntries: [],
    xp: 0,
    highestRank: 'E',
    earnedTitles: [],
  };
}

function food(date: string, kcal: number, p = 10, f = 5, c = 20) {
  return {
    id: crypto.randomUUID(), date, mealType: 'lunch' as const, name: 'test',
    calories: kcal, protein: p, fat: f, carbs: c, addedAt: `${date}T12:00:00Z`,
  };
}

describe('buildHealthReport', () => {
  it('filters by JST range boundaries inclusively (incl. from === to)', () => {
    const data = emptyData();
    data.weightEntries = [
      { id: '1', date: '2026-06-30', weight: 71, addedAt: '2026-06-30T00:00:00Z' }, // before
      { id: '2', date: '2026-07-01', weight: 70, addedAt: '2026-07-01T00:00:00Z' }, // from-boundary
      { id: '3', date: '2026-07-14', weight: 69, addedAt: '2026-07-14T00:00:00Z' }, // to-boundary
      { id: '4', date: '2026-07-15', weight: 68, addedAt: '2026-07-15T00:00:00Z' }, // after
    ];
    const r = buildHealthReport(data, [], RANGE);
    expect(r.weight.series.map((w) => w.date)).toEqual(['2026-07-01', '2026-07-14']);
    expect(r.weight.deltaKg).toBe(-1);

    // Degenerate single-day range keeps exactly that day.
    const single = buildHealthReport(data, [], { from: '2026-07-14', to: '2026-07-14' });
    expect(single.weight.series.map((w) => w.date)).toEqual(['2026-07-14']);
    expect(single.weight.deltaKg).toBeNull(); // <2 points
  });

  it('averages meals over logged days only (empty days do not dilute)', () => {
    const data = emptyData();
    data.foodEntries = [
      food('2026-07-01', 1800),
      food('2026-07-01', 200),  // same day → 2000 total
      food('2026-07-10', 1000),
    ];
    const r = buildHealthReport(data, [], RANGE);
    expect(r.meals.daysLogged).toBe(2);
    expect(r.meals.avgCalories).toBe(1500); // (2000 + 1000) / 2 logged days
  });

  it('computes vitals min/median/max per series without interpretation', () => {
    const data = emptyData();
    data.vitalEntries = [
      { id: 'a', date: '2026-07-02', kind: 'blood_pressure', systolic: 118, diastolic: 76, addedAt: '2026-07-02T08:00:00Z' },
      { id: 'b', date: '2026-07-05', kind: 'blood_pressure', systolic: 126, diastolic: 82, addedAt: '2026-07-05T08:00:00Z' },
      { id: 'c', date: '2026-07-09', kind: 'blood_pressure', systolic: 122, diastolic: 80, addedAt: '2026-07-09T08:00:00Z' },
      { id: 'd', date: '2026-07-03', kind: 'blood_glucose', glucoseMgDl: 95, glucoseContext: 'fasting', addedAt: '2026-07-03T07:00:00Z' },
      { id: 'e', date: '2026-07-04', kind: 'blood_glucose', glucoseMgDl: 105, glucoseContext: 'fasting', addedAt: '2026-07-04T07:00:00Z' },
      { id: 'f', date: '2026-07-04', kind: 'blood_glucose', glucoseMgDl: 140, glucoseContext: 'postprandial', addedAt: '2026-07-04T13:00:00Z' },
    ];
    const r = buildHealthReport(data, [], RANGE);
    expect(r.vitals.systolic).toEqual({ count: 3, min: 118, median: 122, max: 126 });
    expect(r.vitals.diastolic).toEqual({ count: 3, min: 76, median: 80, max: 82 });
    expect(r.vitals.glucoseByContext).toEqual([
      { context: 'fasting', stats: { count: 2, min: 95, median: 100, max: 105 } },
      { context: 'postprandial', stats: { count: 1, min: 140, median: 140, max: 140 } },
    ]);
    expect(r.vitals.bpRows).toHaveLength(3);
  });

  it('orders BP rows and weight series by date (addedAt tie-break), so backfilled entries stay chronological', () => {
    const data = emptyData();
    // '2026-07-03' logged AFTER '2026-07-08' (backfill) — must still render first.
    data.vitalEntries = [
      { id: 'a', date: '2026-07-08', kind: 'blood_pressure', systolic: 126, diastolic: 82, addedAt: '2026-07-08T08:00:00Z' },
      { id: 'b', date: '2026-07-03', kind: 'blood_pressure', systolic: 118, diastolic: 76, addedAt: '2026-07-10T22:00:00Z' },
    ];
    // Two same-day weigh-ins: the later addedAt is "last" for the delta.
    data.weightEntries = [
      { id: '1', date: '2026-07-02', weight: 70, addedAt: '2026-07-02T08:00:00Z' },
      { id: '2', date: '2026-07-10', weight: 68, addedAt: '2026-07-10T21:00:00Z' },
      { id: '3', date: '2026-07-10', weight: 69, addedAt: '2026-07-10T07:00:00Z' },
    ];
    const r = buildHealthReport(data, [], RANGE);
    expect(r.vitals.bpRows.map((v) => v.date)).toEqual(['2026-07-03', '2026-07-08']);
    expect(r.weight.series.map((w) => w.weight)).toEqual([70, 69, 68]);
    expect(r.weight.deltaKg).toBe(-2); // last by addedAt on 07-10 is 68
  });

  it('counts symptoms by name, most frequent first', () => {
    const data = emptyData();
    const sym = (date: string, name: string) => ({
      id: crypto.randomUUID(), date, onsetAt: `${date}T10:00:00Z`, name,
      severity: 5, addedAt: `${date}T10:05:00Z`,
    });
    data.symptomEntries = [
      sym('2026-07-02', '頭痛'), sym('2026-07-05', '頭痛'), sym('2026-07-08', 'めまい'),
      sym('2026-06-20', '頭痛'), // out of range
    ];
    const r = buildHealthReport(data, [], RANGE);
    expect(r.symptoms.rows).toHaveLength(3);
    expect(r.symptoms.countsByName).toEqual([
      { name: '頭痛', count: 2 },
      { name: 'めまい', count: 1 },
    ]);
  });

  it('returns a fully zeroed/empty report for an empty range', () => {
    const checkIns: DailyCheckIn[] = [
      { date: '2026-06-01', mood: 3, energy: 3, sleepHours: 7, sorenessAreas: [] }, // out of range
    ];
    const r = buildHealthReport(emptyData(), checkIns, RANGE);
    expect(r.symptoms.rows).toEqual([]);
    expect(r.symptoms.countsByName).toEqual([]);
    expect(r.meals.daysLogged).toBe(0);
    expect(r.meals.avgCalories).toBeNull();
    expect(r.workouts.sessions).toBe(0);
    expect(r.vitals.systolic).toBeNull();
    expect(r.vitals.glucoseByContext).toEqual([]);
    expect(r.weight.series).toEqual([]);
    expect(r.weight.deltaKg).toBeNull();
    expect(r.wellness.avgSleepHours).toBeNull();
    expect(r.wellness.avgWaterMl).toBeNull();
  });

  it('aggregates wellness from check-ins and water in range', () => {
    const data = emptyData();
    data.waterByDate = { '2026-07-02': 1500, '2026-07-03': 2500, '2026-06-01': 9999, '2026-07-04': 0 };
    const checkIns: DailyCheckIn[] = [
      { date: '2026-07-02', mood: 4, energy: 4, sleepHours: 7, sorenessAreas: [], sleepQuality: 4, stressLevel: 2 },
      { date: '2026-07-03', mood: 3, energy: 3, sleepHours: 6, sorenessAreas: [] }, // no quality/stress
    ];
    const r = buildHealthReport(data, checkIns, RANGE);
    expect(r.wellness.avgSleepHours).toBe(6.5);
    expect(r.wellness.avgSleepQuality).toBe(4); // only days that rated it
    expect(r.wellness.avgStressLevel).toBe(2);
    expect(r.wellness.avgWaterMl).toBe(2000);   // zero-ml day excluded
  });
});
