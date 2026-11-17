/**
 * ADR-011 deleted features whose records live in the same localStorage blob
 * (vitals, symptoms, badges, xp …). A save after the upgrade must not drop
 * them: they are the user's data (code-review 11-17, finding 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addFoodEntry, getAppData, readLegacyKeys } from '../storage';

function makeLocalStorage(init: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(init));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe('legacy keys survive a save', () => {
  beforeEach(() => vi.stubGlobal('window', {}));
  afterEach(() => vi.unstubAllGlobals());

  it('keeps vitalEntries / symptomEntries / xp after addFoodEntry', () => {
    const vitals = [{ id: 'v1', date: '2026-10-01', systolic: 128, diastolic: 82 }];
    const symptoms = [{ id: 's1', date: '2026-10-02', name: 'headache' }];
    const ls = makeLocalStorage({
      'diet-tracker-v1': JSON.stringify({ foodEntries: [], vitalEntries: vitals, symptomEntries: symptoms, xp: 420 }),
    });
    vi.stubGlobal('localStorage', ls);

    addFoodEntry({
      id: 'f1', date: '2026-11-17', mealType: 'lunch', name: 'rice',
      calories: 250, protein: 4, fat: 0.5, carbs: 55, addedAt: '2026-11-17T03:00:00Z',
    });

    const stored = JSON.parse(ls.getItem('diet-tracker-v1')!);
    expect(stored.vitalEntries).toEqual(vitals);
    expect(stored.symptomEntries).toEqual(symptoms);
    expect(stored.xp).toBe(420);
    expect(stored.foodEntries).toHaveLength(1);
    // The typed view stays clean; the legacy keys are readable for export.
    expect(getAppData()).not.toHaveProperty('vitalEntries');
    expect(readLegacyKeys()).toEqual({ vitalEntries: vitals, symptomEntries: symptoms, xp: 420 });
  });

  it('current keys are never treated as legacy', () => {
    vi.stubGlobal('localStorage', makeLocalStorage({
      'diet-tracker-v1': JSON.stringify({ foodEntries: [], goals: { calories: 1800 } }),
    }));
    expect(readLegacyKeys()).toEqual({});
  });
});
