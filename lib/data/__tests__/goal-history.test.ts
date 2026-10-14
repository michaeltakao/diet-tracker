/**
 * lib/data/goal-history.ts — column mapping and the guest no-op.
 *
 * The Supabase insert itself is not exercised here: Supabase is not
 * configured under vitest, so getWriteContext() is null (same stance as
 * exercise-rank.test.ts). That path is checked against a real database.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toGoalColumns, toGoalSnapshot, recordGoalSnapshot, isPurposeChosen, markPurposeChosen,
} from '../goal-history';
import { completeOnboarding, skipOnboarding, DEFAULT_ANSWERS } from '../onboarding';
import type { DailyGoals } from '@/lib/types';

const GOALS: DailyGoals = { calories: 1800.4, protein: 120.26, fat: 55, carbs: 210, water: 2200, goalWeight: 62.04 };

describe('toGoalColumns', () => {
  it('rounds to the column precision', () => {
    expect(toGoalColumns(GOALS)).toEqual({
      goal_calories: 1800, goal_protein_g: 120.3, goal_fat_g: 55, goal_carbs_g: 210,
      goal_water_ml: 2200, goal_weight_kg: 62,
    });
  });

  it('stores a missing, zero or negative goal weight as NULL (CHECK is > 0)', () => {
    expect(toGoalColumns({ ...GOALS, goalWeight: undefined }).goal_weight_kg).toBeNull();
    expect(toGoalColumns({ ...GOALS, goalWeight: 0 }).goal_weight_kg).toBeNull();
    expect(toGoalColumns({ ...GOALS, goalWeight: -5 }).goal_weight_kg).toBeNull();
    expect(toGoalColumns({ ...GOALS, goalWeight: Number.NaN }).goal_weight_kg).toBeNull();
  });

  it('falls back to the app defaults for non-numeric nutrition goals', () => {
    const bad = { calories: Number.NaN, protein: Number.NaN, fat: Number.NaN, carbs: Number.NaN, water: Number.NaN };
    expect(toGoalColumns(bad)).toEqual({
      goal_calories: 2000, goal_protein_g: 150, goal_fat_g: 60, goal_carbs_g: 200,
      goal_water_ml: 2000, goal_weight_kg: null,
    });
  });
});

describe('toGoalSnapshot', () => {
  it('carries the purpose and goal columns, without water', () => {
    expect(toGoalSnapshot('weight_loss', GOALS)).toEqual({
      fitness_goal: 'weight_loss', goal_weight_kg: 62, goal_calories: 1800,
      goal_protein_g: 120.3, goal_fat_g: 55, goal_carbs_g: 210,
    });
  });

  it('leaves every goal column NULL when there are no real targets', () => {
    expect(toGoalSnapshot('maintenance', null)).toEqual({
      fitness_goal: 'maintenance', goal_weight_kg: null, goal_calories: null,
      goal_protein_g: null, goal_fat_g: null, goal_carbs_g: null,
    });
  });
});

describe('recordGoalSnapshot — guest mode', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('guest must not write the dedupe marker'); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('writes nothing and does not throw', async () => {
    await expect(recordGoalSnapshot('weight_loss', GOALS)).resolves.toBeUndefined();
  });
});

describe('isPurposeChosen', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is false on a fresh device and after skipping the whole wizard', () => {
    expect(isPurposeChosen()).toBe(false);
    skipOnboarding();
    expect(isPurposeChosen()).toBe(false);
  });

  it('is false when only the goal step was skipped', () => {
    completeOnboarding({ ...DEFAULT_ANSWERS, defaultedSteps: ['goal'] });
    expect(isPurposeChosen()).toBe(false);
  });

  it('is true when the goal step was answered', () => {
    completeOnboarding({ ...DEFAULT_ANSWERS, fitnessGoal: 'weight_loss', defaultedSteps: ['body'] });
    expect(isPurposeChosen()).toBe(true);
  });

  it('is true once a purpose was picked in Settings', () => {
    skipOnboarding();
    markPurposeChosen();
    expect(isPurposeChosen()).toBe(true);
  });
});

describe('toGoalSnapshot — purpose never chosen', () => {
  it('keeps the goals but stores no purpose', () => {
    expect(toGoalSnapshot(null, GOALS).fitness_goal).toBeNull();
    expect(toGoalSnapshot(null, GOALS).goal_weight_kg).toBe(62);
  });
});
