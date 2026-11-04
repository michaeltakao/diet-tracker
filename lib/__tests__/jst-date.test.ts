/**
 * JST clock helpers (ADR-008 P0-1).
 *
 * Bug B1 (measured 2026-10-15): pages stamped `date` with the UTC day
 * (`toISOString().split('T')[0]`), which is the previous day from 00:00 to
 * 08:59 JST, and `buildTimestamp` made `addedAt` 24 h early from that date.
 *
 * Boundary instants used below (JST = UTC+9, no DST):
 *   2026-10-28T14:59Z = 10-28 23:59 JST
 *   2026-10-28T15:00Z = 10-29 00:00 JST
 *   2026-10-28T23:59Z = 10-29 08:59 JST  ← UTC day is still 10-28
 *   2026-10-29T00:00Z = 10-29 09:00 JST  ← UTC and JST days agree again
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { jstTimestamp, nowJstTime, todayJst, toJstDate, todayStr } from '../format-date';
import { jstToday, shiftDate } from '../streak';
import { addFoodEntry, addWater, addWeightEntry, addWorkoutEntry, checkAndAwardBadges, getAppData } from '../storage';
import type { FoodEntry, WeightEntry, WorkoutEntry } from '../types';

const BOUNDARIES = [
  { utc: '2026-10-28T14:59:00Z', jstDate: '2026-10-28', jstTime: '23:59' },
  { utc: '2026-10-28T15:00:00Z', jstDate: '2026-10-29', jstTime: '00:00' },
  { utc: '2026-10-28T23:59:00Z', jstDate: '2026-10-29', jstTime: '08:59' },
  { utc: '2026-10-29T00:00:00Z', jstDate: '2026-10-29', jstTime: '09:00' },
] as const;

describe('JST clock helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(BOUNDARIES)('$utc → $jstDate $jstTime JST', ({ utc, jstDate, jstTime }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(utc));
    expect(todayJst()).toBe(jstDate);
    expect(todayStr()).toBe(jstDate);
    expect(jstToday()).toBe(jstDate);
    expect(toJstDate(new Date(utc))).toBe(jstDate);
    expect(nowJstTime()).toBe(jstTime);
  });

  it('differs from the old UTC-day pattern exactly in the 00:00–08:59 JST window', () => {
    const utcDay = (iso: string) => new Date(iso).toISOString().split('T')[0];
    const diverges = BOUNDARIES.map(({ utc }) => toJstDate(new Date(utc)) !== utcDay(utc));
    expect(diverges).toEqual([false, true, true, false]);
  });

  it.each(BOUNDARIES)('jstTimestamp($jstDate, $jstTime) is the original instant', ({ utc, jstDate, jstTime }) => {
    const iso = jstTimestamp(jstDate, jstTime);
    expect(iso).toBe(new Date(utc).toISOString());
    // addedAt falls on the same JST day as `date` — no 24 h shift.
    expect(toJstDate(new Date(iso))).toBe(jstDate);
  });

  it('does not depend on the process time zone', () => {
    const saved = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
        process.env.TZ = tz;
        expect(toJstDate(new Date('2026-10-28T23:59:00Z'))).toBe('2026-10-29');
        expect(jstTimestamp('2026-10-29', '08:59')).toBe('2026-10-28T23:59:00.000Z');
      }
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  });
});

// ── Write paths: what a page stores at 08:59 JST ─────────────────────────────

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe('stored dates at 08:59 JST (the B1 window)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T23:59:00Z')); // 10-29 08:59 JST
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', makeLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('water, weight and meal rows carry the JST day; meal addedAt matches it', () => {
    const date = todayJst();
    const addedAt = jstTimestamp(date, nowJstTime());
    addWater(date, 300);
    const w: WeightEntry = { id: 'w1', date, weight: 72.4, addedAt };
    addWeightEntry(w);
    const f: FoodEntry = {
      id: 'f1', date, mealType: 'breakfast', name: 'rice',
      calories: 400, protein: 8, fat: 1, carbs: 80, addedAt,
    };
    addFoodEntry(f);

    const data = getAppData();
    expect(Object.keys(data.waterByDate)).toEqual(['2026-10-29']);
    expect(data.weightEntries.map((e) => e.date)).toEqual(['2026-10-29']);
    expect(data.foodEntries[0].date).toBe('2026-10-29');
    expect(data.foodEntries[0].addedAt).toBe('2026-10-28T23:59:00.000Z');
    expect(toJstDate(new Date(data.foodEntries[0].addedAt))).toBe(data.foodEntries[0].date);
  });

  it.each([
    { offsets: [-6, -5, -4, -3, -2], awarded: true },  // 5 days inside [today-6, today]
    { offsets: [-7, -5, -4, -3, -2], awarded: false }, // today-7 is outside the window
  ])('workout_master window: $offsets → $awarded', ({ offsets, awarded }) => {
    const today = todayJst();
    for (const o of offsets) {
      const w: WorkoutEntry = {
        id: `w${o}`, date: shiftDate(today, o), name: 'squat', category: 'strength',
        addedAt: jstTimestamp(shiftDate(today, o), '07:00'),
      };
      addWorkoutEntry(w);
    }
    const types = checkAndAwardBadges(today).map((b) => b.type);
    expect(types.includes('workout_master')).toBe(awarded);
  });
});
