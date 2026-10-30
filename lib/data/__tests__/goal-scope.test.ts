/**
 * updateGoals server scope: which profiles columns an onboarding save may
 * touch (ADR-008 P0-12 adds 'weight' — goal weight only).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const updates: Array<Record<string, unknown>> = [];
vi.mock('../_write', () => ({
  getWriteContext: async () => ({
    userId: 'u1',
    supabase: {
      from: () => ({
        update: (row: Record<string, unknown>) => {
          updates.push(row);
          return { eq: async () => ({ error: null }) };
        },
      }),
    },
  }),
}));

import { updateGoals } from '../profile';
import type { DailyGoals } from '@/lib/types';

const GOALS: DailyGoals = { calories: 1800, protein: 120, fat: 55, carbs: 210, water: 2000, goalWeight: 62 };
const flush = () => new Promise((r) => setTimeout(r, 0));

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe('updateGoals server scope', () => {
  beforeEach(() => {
    updates.length = 0;
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', makeLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("'all' writes nutrition and goal weight", async () => {
    updateGoals(GOALS, 'all'); await flush();
    expect(Object.keys(updates[0]).sort()).toEqual(
      ['goal_calories', 'goal_carbs_g', 'goal_fat_g', 'goal_protein_g', 'goal_water_ml', 'goal_weight_kg'],
    );
  });

  it("'nutrition' leaves goal_weight_kg alone", async () => {
    updateGoals(GOALS, 'nutrition'); await flush();
    expect(updates[0]).not.toHaveProperty('goal_weight_kg');
    expect(updates[0]).toHaveProperty('goal_calories', 1800);
  });

  it("'weight' writes only goal_weight_kg (placeholder targets stay local)", async () => {
    updateGoals(GOALS, 'weight'); await flush();
    expect(updates).toEqual([{ goal_weight_kg: 62 }]);
  });

  it("'none' writes nothing", async () => {
    updateGoals(GOALS, 'none'); await flush();
    expect(updates).toEqual([]);
  });
});
