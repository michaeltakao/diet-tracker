/**
 * getAppData() on empty storage must not hand out the module-level defaults:
 * a shallow copy let add*() mutate them, so a later empty-storage read (new
 * account, cleared storage) showed the previous rows again.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addFoodEntry, addWorkoutEntry, getAppData } from '../storage';

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe('getAppData defaults', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a fresh (empty) storage starts empty even after writes to another one', () => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    addFoodEntry({
      id: 'f1', date: '2026-10-29', mealType: 'lunch', name: 'rice',
      calories: 400, protein: 8, fat: 1, carbs: 80, addedAt: '2026-10-29T03:00:00.000Z',
    });
    addWorkoutEntry({ id: 'w1', date: '2026-10-29', name: 'squat', category: 'strength', addedAt: '2026-10-29T03:00:00.000Z' });

    vi.stubGlobal('localStorage', makeLocalStorage());
    const data = getAppData();
    expect(data.foodEntries).toEqual([]);
    expect(data.workoutEntries).toEqual([]);
  });

  it('mutating a returned default does not leak into the next read', () => {
    vi.stubGlobal('localStorage', makeLocalStorage());
    getAppData().goals.calories = 1;
    expect(getAppData().goals.calories).not.toBe(1);
  });
});
