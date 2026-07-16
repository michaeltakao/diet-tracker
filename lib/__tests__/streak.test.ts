/**
 * Any-log streak engine tests (FTUE roadmap 2026-07).
 *
 * Pure-math suite exercises lib/streak.ts directly with a fixed `today`
 * (no clock, no localStorage). The integration suite stubs localStorage
 * (same pattern as favorites.test.ts) and drives lib/storage.ts, whose
 * getStreak/getStreakState use the real JST clock via jstToday().
 *
 * Calendar facts used below (verifiable against any ISO-8601 calendar):
 *   2026-07-13 = Monday, ISO week 2026-W29 (Mon 07-13 … Sun 07-19)
 *   2026-01-01 = Thursday → 2026-W01
 *   2024-12-30 = Monday   → 2025-W01 (ISO year rolls forward)
 *   2021-01-01 = Friday   → 2020-W53 (ISO year rolls backward)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  activityDaysFrom,
  computeStreak,
  countActivityDaysInWeek,
  isoWeekKey,
  jstToday,
  shiftDate,
  weekStartOf,
} from '../streak';
import {
  addFoodEntry,
  addWorkoutEntry,
  addWeightEntry,
  addWater,
  getStreak,
  getStreakState,
  checkAndAwardBadges,
  getBadges,
} from '../storage';
import type { FoodEntry, StreakState, WeightEntry, WorkoutEntry } from '../types';

const EMPTY: StreakState = { longest: 0, repairedDates: [] };
const state = (longest = 0, repairedDates: string[] = []): StreakState => ({
  longest,
  repairedDates,
});

// ── Calendar helpers ──────────────────────────────────────────

describe('shiftDate', () => {
  it('crosses month and leap-year boundaries', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29'); // leap year
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01');
    expect(shiftDate('2026-07-15', 0)).toBe('2026-07-15');
  });
});

describe('isoWeekKey', () => {
  it('matches known ISO-8601 week numbers', () => {
    expect(isoWeekKey('2026-07-15')).toBe('2026-W29');
    expect(isoWeekKey('2026-07-13')).toBe('2026-W29'); // Monday edge
    expect(isoWeekKey('2026-07-19')).toBe('2026-W29'); // Sunday edge
    expect(isoWeekKey('2026-07-20')).toBe('2026-W30'); // next Monday
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01'); // ISO year > calendar year
    expect(isoWeekKey('2021-01-01')).toBe('2020-W53'); // ISO year < calendar year
  });
});

describe('weekStartOf', () => {
  it('returns the ISO Monday of the containing week', () => {
    expect(weekStartOf('2026-07-15')).toBe('2026-07-13'); // Wed → Mon
    expect(weekStartOf('2026-07-13')).toBe('2026-07-13'); // Mon → itself
    expect(weekStartOf('2026-07-19')).toBe('2026-07-13'); // Sun → same week's Mon
  });
});

// ── Any-log union ─────────────────────────────────────────────

describe('activityDaysFrom', () => {
  it('unions food, workout, weight, vitals, and water>0 days; excludes water=0', () => {
    const days = activityDaysFrom({
      foodEntries:    [{ date: '2026-07-10' } as never],
      workoutEntries: [{ date: '2026-07-11' } as never],
      weightEntries:  [{ date: '2026-07-12' } as never],
      vitalEntries:   [{ date: '2026-07-09' } as never],
      waterByDate:    { '2026-07-13': 500, '2026-07-14': 0 },
    });
    expect(days).toEqual(
      new Set(['2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12', '2026-07-13']),
    );
  });
});

// ── Streak walk ───────────────────────────────────────────────

const TODAY = '2026-07-15'; // Wednesday, 2026-W29

describe('computeStreak', () => {
  it('returns 0 for no activity', () => {
    const r = computeStreak(new Set(), EMPTY, TODAY);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(0);
    expect(r.repairedDates).toEqual([]);
    expect(r.repairAvailable).toBe(true);
  });

  it('counts a plain consecutive run ending today', () => {
    const days = new Set(['2026-07-13', '2026-07-14', '2026-07-15']);
    expect(computeStreak(days, EMPTY, TODAY).current).toBe(3);
  });

  it('gives today grace: unlogged today neither breaks nor consumes a ticket', () => {
    const days = new Set(['2026-07-13', '2026-07-14']);
    const r = computeStreak(days, EMPTY, TODAY);
    expect(r.current).toBe(2);
    expect(r.repairedDates).toEqual([]); // grace, not repair
    expect(r.repairAvailable).toBe(true);
  });

  it('bridges a single gap with the weekly ticket; bridged day does not count', () => {
    // today ✓, 07-14 gap, 07-13 ✓ → ticket bridges 07-14
    const days = new Set(['2026-07-13', '2026-07-15']);
    const r = computeStreak(days, EMPTY, TODAY);
    expect(r.current).toBe(2); // honest count: logged days only
    expect(r.repairedDates).toEqual(['2026-07-14']);
    expect(r.repairAvailable).toBe(false); // W29 ticket consumed
  });

  it('is stable under recomputation with the persisted repair state', () => {
    const days = new Set(['2026-07-13', '2026-07-15']);
    const first = computeStreak(days, EMPTY, TODAY);
    const second = computeStreak(days, state(first.longest, first.repairedDates), TODAY);
    expect(second.current).toBe(first.current);
    expect(second.repairedDates).toEqual(first.repairedDates);
    expect(second.repairAvailable).toBe(false);
  });

  it('breaks on a second gap within the same ISO week', () => {
    // Sunday 07-19 (W29): 19 ✓, 18 gap→repair, 17 ✓, 16 gap → break
    const days = new Set(['2026-07-15', '2026-07-17', '2026-07-19']);
    const r = computeStreak(days, EMPTY, '2026-07-19');
    expect(r.current).toBe(2); // 19 + 17
    expect(r.repairedDates).toEqual(['2026-07-18']);
  });

  it('bridges one gap per week across week boundaries', () => {
    // 15 ✓ | 14 gap (W29→repair) | 13 ✓ | 12 ✓ | 11 gap (W28→repair) | 10 ✓ | 09 gap → break
    const days = new Set(['2026-07-10', '2026-07-12', '2026-07-13', '2026-07-15']);
    const r = computeStreak(days, EMPTY, TODAY);
    expect(r.current).toBe(4);
    expect(r.repairedDates).toEqual(['2026-07-11', '2026-07-14']);
    expect(r.repairAvailable).toBe(false);
  });

  it('never wastes a ticket on a trailing gap that cannot extend the streak', () => {
    // today ✓, 14 gap, 13 gap → look-ahead fails at 14 → break, no consumption
    const days = new Set(['2026-07-15']);
    const r = computeStreak(days, EMPTY, TODAY);
    expect(r.current).toBe(1);
    expect(r.repairedDates).toEqual([]);
    expect(r.repairAvailable).toBe(true);
  });

  it('tracks longest as max(previous, current) in both directions', () => {
    const days = new Set(['2026-07-14', '2026-07-15']);
    expect(computeStreak(days, state(10), TODAY).longest).toBe(10); // keeps prior peak
    expect(computeStreak(days, state(1), TODAY).longest).toBe(2);   // new peak
  });

  it('prunes repaired dates beyond the walk horizon', () => {
    const r = computeStreak(new Set(['2026-07-15']), state(0, ['2020-01-01']), TODAY);
    expect(r.repairedDates).toEqual([]);
  });

  it('a past-week repair does not block the current week ticket', () => {
    // repaired date in W28 → W29 ticket still available
    const days = new Set(['2026-07-13', '2026-07-15']);
    const r = computeStreak(days, state(0, ['2026-07-11']), TODAY);
    expect(r.repairedDates).toContain('2026-07-14'); // W29 ticket consumed now
  });
});

describe('countActivityDaysInWeek', () => {
  it('counts distinct days inside [Mon, Mon+6] only', () => {
    const days = new Set([
      '2026-07-12', // Sun before → out
      '2026-07-13', // Mon → in
      '2026-07-19', // Sun → in
      '2026-07-20', // next Mon → out
    ]);
    expect(countActivityDaysInWeek(days, '2026-07-13')).toBe(2);
  });
});

// ── Storage integration (localStorage stub, real JST clock) ──

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

const food = (date: string): FoodEntry => ({
  id: crypto.randomUUID(), date, mealType: 'lunch', name: 'rice',
  calories: 400, protein: 8, fat: 1, carbs: 80, addedAt: new Date().toISOString(),
});
const workout = (date: string): WorkoutEntry => ({
  id: crypto.randomUUID(), date, name: 'squat', category: 'strength',
  addedAt: new Date().toISOString(),
});
const weight = (date: string): WeightEntry => ({
  id: crypto.randomUUID(), date, weight: 70, addedAt: new Date().toISOString(),
});

describe('storage integration (any-log streak + first-log badges)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', makeLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts a mixed food/workout/weight/water run as one streak', () => {
    const today = jstToday();
    addFoodEntry(food(today));
    addWorkoutEntry(workout(shiftDate(today, -1)));
    addWeightEntry(weight(shiftDate(today, -2)));
    addWater(shiftDate(today, -3), 300);
    expect(getStreak()).toBe(4);
  });

  it('persists longest and repair consumption across reads', () => {
    const today = jstToday();
    addFoodEntry(food(today));
    addWorkoutEntry(workout(shiftDate(today, -2))); // gap at today-1
    const s1 = getStreakState();
    expect(s1.current).toBe(2); // bridged gap does not count
    // The consumed ticket belongs to (today-1)'s ISO week; only when that is
    // today's week is this week's ticket gone (i.e. any day but Monday).
    const gapInThisWeek = isoWeekKey(shiftDate(jstToday(), -1)) === isoWeekKey(jstToday());
    expect(s1.repairAvailable).toBe(!gapInThisWeek);
    const s2 = getStreakState(); // recompute from persisted state
    expect(s2.current).toBe(2);
    expect(s2.longest).toBeGreaterThanOrEqual(2);
  });

  it('awards first_food and first_workout exactly once', () => {
    const today = jstToday();
    addFoodEntry(food(today));
    let earned = checkAndAwardBadges(today).map((b) => b.type);
    expect(earned).toContain('first_food');
    expect(earned).not.toContain('first_workout');

    addWorkoutEntry(workout(today));
    earned = checkAndAwardBadges(today).map((b) => b.type);
    expect(earned).toContain('first_workout');
    expect(earned).not.toContain('first_food'); // idempotent

    // Third pass awards neither again
    earned = checkAndAwardBadges(today).map((b) => b.type);
    expect(earned).not.toContain('first_food');
    expect(earned).not.toContain('first_workout');
    expect(getBadges().filter((b) => b.type === 'first_food')).toHaveLength(1);
    expect(getBadges().filter((b) => b.type === 'first_workout')).toHaveLength(1);
  });
});
