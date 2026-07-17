/**
 * Pure-math tests for computeCategoryStats (dashboard phase 5).
 *
 * Fixed `today` throughout — no clock, no localStorage. Entry objects are
 * minimal casts: computeCategoryStats only reads `.date` (YYYY-MM-DD JST).
 *
 * Calendar facts (same as streak.test.ts):
 *   2026-07-13 = Monday, 2026-07-19 = Sunday (ISO week 2026-W29)
 *   2026-07-20 = Monday (2026-W30)
 */
import { describe, it, expect } from 'vitest';
import { computeCategoryStats, CATEGORY_KEYS, type CategoryKey } from '../dashboard-data';
import type { FoodEntry, SymptomEntry, VitalEntry, WorkoutEntry } from '../types';

const food = (date: string) => ({ date }) as FoodEntry;
const workout = (date: string) => ({ date }) as WorkoutEntry;
const vital = (date: string) => ({ date }) as VitalEntry;
const symptom = (date: string) => ({ date }) as SymptomEntry;

const data = (over: {
  foodEntries?: FoodEntry[];
  workoutEntries?: WorkoutEntry[];
  vitalEntries?: VitalEntry[];
  symptomEntries?: SymptomEntry[];
} = {}) => ({
  foodEntries: [],
  workoutEntries: [],
  vitalEntries: [],
  symptomEntries: [],
  ...over,
});

const byKey = (stats: ReturnType<typeof computeCategoryStats>, key: CategoryKey) => {
  const c = stats.categories.find((s) => s.key === key);
  if (!c) throw new Error(`missing category ${key}`);
  return c;
};

describe('computeCategoryStats — empty data', () => {
  it('returns all four categories zeroed', () => {
    const stats = computeCategoryStats(data(), '2026-07-15');
    expect(stats.categories.map((c) => c.key)).toEqual([...CATEGORY_KEYS]);
    for (const c of stats.categories) {
      expect(c.loggedToday).toBe(false);
      expect(c.weekDays).toBe(0);
    }
    expect(stats.todayPct).toBe(0);
  });
});

describe('computeCategoryStats — binary loggedToday', () => {
  it('multiple same-day entries count once (25% per category)', () => {
    const stats = computeCategoryStats(
      data({ foodEntries: [food('2026-07-15'), food('2026-07-15'), food('2026-07-15')] }),
      '2026-07-15',
    );
    expect(byKey(stats, 'meal').loggedToday).toBe(true);
    expect(byKey(stats, 'meal').weekDays).toBe(1);
    expect(stats.todayPct).toBe(25);
  });

  it('categories are independent; entries on other days do not count today', () => {
    const stats = computeCategoryStats(
      data({
        foodEntries: [food('2026-07-14')], // yesterday only
        workoutEntries: [workout('2026-07-15')],
        vitalEntries: [vital('2026-07-15')],
        symptomEntries: [symptom('2026-07-15')],
      }),
      '2026-07-15',
    );
    expect(byKey(stats, 'meal').loggedToday).toBe(false);
    expect(byKey(stats, 'exercise').loggedToday).toBe(true);
    expect(byKey(stats, 'vital').loggedToday).toBe(true);
    expect(byKey(stats, 'symptom').loggedToday).toBe(true);
    expect(stats.todayPct).toBe(75);
  });

  it('all four logged today → 100%', () => {
    const stats = computeCategoryStats(
      data({
        foodEntries: [food('2026-07-15')],
        workoutEntries: [workout('2026-07-15')],
        vitalEntries: [vital('2026-07-15')],
        symptomEntries: [symptom('2026-07-15')],
      }),
      '2026-07-15',
    );
    expect(stats.todayPct).toBe(100);
    expect(stats.categories.every((c) => c.loggedToday)).toBe(true);
  });
});

describe('computeCategoryStats — per-category week counting', () => {
  it('counts distinct days inside the Mon–Sun window only', () => {
    const stats = computeCategoryStats(
      data({
        foodEntries: [
          food('2026-07-13'), // Monday (week start)
          food('2026-07-13'), // duplicate day → still 1
          food('2026-07-15'),
          food('2026-07-19'), // Sunday (week end)
          food('2026-07-12'), // previous Sunday → out
          food('2026-07-20'), // next Monday → out
        ],
        workoutEntries: [workout('2026-07-14'), workout('2026-07-16')],
      }),
      '2026-07-15',
    );
    expect(byKey(stats, 'meal').weekDays).toBe(3);
    expect(byKey(stats, 'exercise').weekDays).toBe(2);
    expect(byKey(stats, 'vital').weekDays).toBe(0);
  });
});

describe('computeCategoryStats — JST week boundary (Sun→Mon rollover)', () => {
  it('Sunday: entries from Monday of the same week still count', () => {
    const stats = computeCategoryStats(
      data({ foodEntries: [food('2026-07-13'), food('2026-07-19')] }),
      '2026-07-19', // Sunday
    );
    expect(byKey(stats, 'meal').weekDays).toBe(2);
    expect(byKey(stats, 'meal').loggedToday).toBe(true);
  });

  it('Monday: last week resets — only the new week counts', () => {
    const stats = computeCategoryStats(
      data({ foodEntries: [food('2026-07-13'), food('2026-07-19'), food('2026-07-20')] }),
      '2026-07-20', // next Monday
    );
    expect(byKey(stats, 'meal').weekDays).toBe(1);
    expect(byKey(stats, 'meal').loggedToday).toBe(true);
  });
});

describe('computeCategoryStats — todayPct values', () => {
  it('is 0/25/50/75/100 for 0–4 logged categories', () => {
    const today = '2026-07-15';
    const cases: Array<[ReturnType<typeof data>, number]> = [
      [data(), 0],
      [data({ foodEntries: [food(today)] }), 25],
      [data({ foodEntries: [food(today)], workoutEntries: [workout(today)] }), 50],
      [
        data({
          foodEntries: [food(today)],
          workoutEntries: [workout(today)],
          vitalEntries: [vital(today)],
        }),
        75,
      ],
      [
        data({
          foodEntries: [food(today)],
          workoutEntries: [workout(today)],
          vitalEntries: [vital(today)],
          symptomEntries: [symptom(today)],
        }),
        100,
      ],
    ];
    for (const [d, pct] of cases) {
      expect(computeCategoryStats(d, today).todayPct).toBe(pct);
    }
  });
});
