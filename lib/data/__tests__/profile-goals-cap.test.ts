/**
 * getRealGoals() read-time CKD protein cap (2026-11-17). Same localStorage
 * stub pattern as exercise-rank.test.ts (guest mode: Supabase unconfigured,
 * so dual-writes are no-ops).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGoals, getRealGoals, updateGoals } from '../profile';
import { addWeightEntry } from '../weight';
import { updateHealthProfile, DEFAULT_HEALTH_PROFILE } from '../health-profile';
import { DEFAULT_GOALS } from '@/lib/storage';

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', makeLocalStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const STORED = { ...DEFAULT_GOALS, protein: 120 };

async function seed(conditions: string[], weightKg: number | null) {
  updateGoals(STORED); // differs from defaults → "real" goals
  updateHealthProfile({ ...DEFAULT_HEALTH_PROFILE, healthConditions: conditions });
  if (weightKg != null) {
    await addWeightEntry({ id: 'w1', date: '2026-11-17', weight: weightKg, addedAt: new Date().toISOString() });
  }
}

describe('getRealGoals — CKD protein cap at read time', () => {
  it('caps a 120 g goal to 57 g for CKD at 72 kg, leaving storage raw', async () => {
    await seed(['腎臓病'], 72);
    const real = getRealGoals();
    expect(real?.protein).toBe(57);
    expect({ ...real, protein: 120 }).toEqual(STORED);
    expect(getGoals().protein).toBe(120);
  });

  it('does not cap without a weight entry', async () => {
    await seed(['腎臓病'], null);
    expect(getRealGoals()?.protein).toBe(120);
  });

  it('does not cap non-CKD users', async () => {
    await seed(['高血圧'], 72);
    expect(getRealGoals()?.protein).toBe(120);
  });

  it('still returns null for fabricated defaults', () => {
    updateHealthProfile({ ...DEFAULT_HEALTH_PROFILE, healthConditions: ['腎臓病'] });
    expect(getRealGoals()).toBeNull();
  });
});
