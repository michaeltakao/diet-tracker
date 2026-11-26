import { describe, it, expect } from 'vitest';
import type { FoodEntry } from '../types';
import {
  groupBySlot, filledMainSlots, lastSlotMeal, recentForSlot, repeatEntry,
  guessSlotForTime, planCopyYesterday, isMealSlot,
} from '../meal-slots';

let n = 0;
const e = (over: Partial<FoodEntry>): FoodEntry => ({
  id: `id${++n}`, date: '2026-11-26', mealType: 'dinner', name: 'x',
  calories: 100, protein: 10, fat: 5, carbs: 10, addedAt: '2026-11-26T10:00:00.000Z', ...over,
});

describe('groupBySlot / filledMainSlots', () => {
  it('groups in logging order and ignores snack for the 3-meal count', () => {
    const a = e({ mealType: 'lunch', addedAt: '2026-11-26T04:00:00.000Z', name: 'b' });
    const b = e({ mealType: 'lunch', addedAt: '2026-11-26T03:00:00.000Z', name: 'a' });
    const s = e({ mealType: 'snack' });
    const g = groupBySlot([a, b, s]);
    expect(g.lunch.map((x) => x.name)).toEqual(['a', 'b']);
    expect(g.breakfast).toEqual([]);
    expect(filledMainSlots([a, b, s])).toEqual(['lunch']);
  });
});

describe('lastSlotMeal', () => {
  const all = [
    e({ date: '2026-11-24', mealType: 'dinner', name: 'old', calories: 900 }),
    e({ date: '2026-11-25', mealType: 'dinner', name: 'rice', calories: 250, addedAt: '2026-11-25T10:00:00.000Z' }),
    e({ date: '2026-11-25', mealType: 'dinner', name: 'chicken', calories: 330, addedAt: '2026-11-25T09:00:00.000Z' }),
    e({ date: '2026-11-25', mealType: 'lunch', name: 'noodles' }),
    e({ date: '2026-11-26', mealType: 'dinner', name: 'today' }),
  ];

  it('returns every entry of the latest earlier day in that slot, ordered', () => {
    const m = lastSlotMeal(all, 'dinner', '2026-11-26');
    expect(m?.date).toBe('2026-11-25');
    expect(m?.entries.map((x) => x.name)).toEqual(['chicken', 'rice']);
    expect(m?.calories).toBe(580);
  });

  it('never returns today and is null when nothing earlier exists', () => {
    expect(lastSlotMeal(all, 'breakfast', '2026-11-26')).toBeNull();
    expect(lastSlotMeal([e({ date: '2026-11-26' })], 'dinner', '2026-11-26')).toBeNull();
  });
});

describe('recentForSlot', () => {
  it('dedupes by name, newest first, limited, slot-scoped', () => {
    const all = [
      e({ name: 'A', addedAt: '2026-11-20T00:00:00.000Z' }),
      e({ name: 'B', addedAt: '2026-11-21T00:00:00.000Z' }),
      e({ name: 'A', addedAt: '2026-11-22T00:00:00.000Z' }),
      e({ name: 'C', addedAt: '2026-11-23T00:00:00.000Z' }),
      e({ name: 'D', addedAt: '2026-11-24T00:00:00.000Z', mealType: 'lunch' }),
      e({ name: 'E', addedAt: '2026-11-19T00:00:00.000Z' }),
    ];
    expect(recentForSlot(all, 'dinner', 3).map((x) => x.name)).toEqual(['C', 'A', 'B']);
  });
});

describe('repeatEntry', () => {
  it('keeps nutrition + provenance, resets id/date/time/photo, sets slot', () => {
    const src = e({ macrosEntered: false, source: 'barcode', sourceId: '490', photoDataUrl: 'data:x', mealType: 'lunch' });
    const r = repeatEntry(src, 'dinner', '2026-11-27', 'T', 'new');
    expect(r).toMatchObject({ id: 'new', date: '2026-11-27', addedAt: 'T', mealType: 'dinner', macrosEntered: false, source: 'barcode', sourceId: '490' });
    expect(r.photoDataUrl).toBeUndefined();
  });
});

describe('guessSlotForTime (unchanged /add thresholds)', () => {
  it.each([['09:59', 'breakfast'], ['10:00', 'lunch'], ['13:59', 'lunch'], ['14:00', 'dinner'], ['19:59', 'dinner'], ['20:00', 'snack']])(
    '%s → %s', (t, want) => expect(guessSlotForTime(t)).toBe(want));
});

describe('isMealSlot', () => {
  it('accepts the four slots only', () => {
    expect(isMealSlot('dinner')).toBe(true);
    expect(isMealSlot('brunch')).toBe(false);
    expect(isMealSlot(null)).toBe(false);
  });
});

describe('planCopyYesterday (duplicate guard)', () => {
  const all = [e({ date: '2026-11-25', calories: 400 }), e({ date: '2026-11-25', calories: 250 }), e({ date: '2026-11-26' })];
  it('plans yesterday only with total kcal', () => {
    const p = planCopyYesterday(all, '2026-11-26', '2026-11-25', null);
    expect(p).toMatchObject({ ok: true, calories: 650 });
    expect(p.ok && p.entries.length).toBe(2);
  });
  it('refuses a second copy on the same day', () => {
    expect(planCopyYesterday(all, '2026-11-26', '2026-11-25', '2026-11-26')).toEqual({ ok: false, reason: 'already-copied' });
  });
  it('allows a copy on a later day', () => {
    expect(planCopyYesterday(all, '2026-11-26', '2026-11-25', '2026-11-25').ok).toBe(true);
  });
  it('reports empty yesterday', () => {
    expect(planCopyYesterday(all, '2026-11-26', '2026-11-24', null)).toEqual({ ok: false, reason: 'empty' });
  });
});
