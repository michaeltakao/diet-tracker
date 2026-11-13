/**
 * Every analysed log write carries the build stamp (vault ADR-008 P0-11,
 * migration 027): food add + edit, weight, workout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const upserts: Array<{ table: string; row: Record<string, unknown> }> = [];
vi.mock('../_write', () => ({
  getWriteContext: async () => ({
    userId: 'u1',
    supabase: {
      from: (table: string) => ({
        upsert: async (row: Record<string, unknown>) => {
          upserts.push({ table, row });
          return { error: null };
        },
        // Weight's last-write-wins read (lib/data/outbox.ts): no server row yet.
        select: () => {
          const q = { eq: () => q, maybeSingle: async () => ({ data: null, error: null }) };
          return q;
        },
      }),
    },
  }),
}));

// The localStorage half of the dual write is not under test here.
vi.mock('@/lib/storage', () => ({
  addFoodEntry: vi.fn(), updateFoodEntry: vi.fn(), removeFoodEntry: vi.fn(),
  getEntriesForDate: vi.fn(), getRecentFoods: vi.fn(),
  addWeightEntry: vi.fn(), removeWeightEntry: vi.fn(), getWeightEntries: vi.fn(), getLatestWeight: vi.fn(),
  addWorkoutEntry: vi.fn(), removeWorkoutEntry: vi.fn(), getWorkoutsForDate: vi.fn(),
  checkAndUpdatePR: vi.fn(), getPersonalRecord: vi.fn(),
  getAppData: vi.fn(),
}));

import { addFoodEntry, updateFoodEntry } from '../food';
import { addWeightEntry } from '../weight';
import { addWorkoutEntry } from '../workout';
import type { FoodEntry, WeightEntry, WorkoutEntry } from '@/lib/types';

const FOOD: FoodEntry = {
  id: 'f1', date: '2026-11-04', mealType: 'lunch', name: 'rice',
  calories: 250, protein: 4, fat: 0.5, carbs: 55, addedAt: '2026-11-04T03:00:00.000Z',
};
const WEIGHT: WeightEntry = { id: 'w1', date: '2026-11-04', weight: 72.4, addedAt: '2026-11-04T00:00:00.000Z' };
const WORKOUT: WorkoutEntry = {
  id: 'k1', date: '2026-11-04', name: 'Squat', category: 'strength', sets: 3, reps: 5, weight: 60,
  addedAt: '2026-11-04T10:00:00.000Z',
};

const STAMP = { build_sha: 'abc123', study_build: true };

describe('log writes carry the build stamp', () => {
  beforeEach(() => {
    upserts.length = 0;
    vi.stubEnv('NEXT_PUBLIC_BUILD_SHA', 'abc123');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('food add', async () => {
    await addFoodEntry(FOOD);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe('food_logs');
    expect(upserts[0].row).toMatchObject({ id: 'f1', user_id: 'u1', ...STAMP });
  });

  it('food edit', async () => {
    await updateFoodEntry(FOOD);
    expect(upserts[0].table).toBe('food_logs');
    expect(upserts[0].row).toMatchObject({ id: 'f1', ...STAMP });
  });

  it('weight', async () => {
    await addWeightEntry(WEIGHT);
    expect(upserts[0].table).toBe('weight_logs');
    expect(upserts[0].row).toMatchObject({ weight_kg: 72.4, ...STAMP });
  });

  it('workout', async () => {
    await addWorkoutEntry(WORKOUT);
    expect(upserts[0].table).toBe('workout_logs');
    expect(upserts[0].row).toMatchObject({ name: 'Squat', ...STAMP });
  });

  it('a normal (non-study) build stamps study_build = false', async () => {
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '');
    await addWeightEntry(WEIGHT);
    expect(upserts[0].row).toMatchObject({ build_sha: 'abc123', study_build: false });
  });
});
