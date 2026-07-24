/**
 * lib/data/exercise-rank.ts round-trip test — localStorage read/write, same
 * jsdom stub pattern as lib/__tests__/steps.test.ts (guest mode:
 * getWriteContext() is a no-op since Supabase isn't configured in the test
 * environment).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getExerciseRankState, recomputeAndPersistExerciseRank } from '../exercise-rank';
import { addWeightEntry } from '../weight';
import { updateHealthProfile, DEFAULT_HEALTH_PROFILE } from '../health-profile';

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

async function setBodyweight(kg: number) {
  await addWeightEntry({ id: 'w1', date: '2026-07-25', weight: kg, addedAt: new Date().toISOString() });
}

describe('getExerciseRankState — read', () => {
  it('returns undefined when no rank has ever been achieved', () => {
    expect(getExerciseRankState('bench-press')).toBeUndefined();
  });
});

describe('recomputeAndPersistExerciseRank', () => {
  it('returns null for a non-rankable exercise (not an error)', async () => {
    const result = await recomputeAndPersistExerciseRank('crunch', 100);
    expect(result).toBeNull();
    expect(getExerciseRankState('crunch')).toBeUndefined();
  });

  it('stays unranked (no persisted row) when no bodyweight is on file', async () => {
    const result = await recomputeAndPersistExerciseRank('bench-press', 60);
    expect(result).toEqual({ oldRank: 'unranked', newRank: 'unranked' });
    expect(getExerciseRankState('bench-press')).toBeUndefined();
  });

  it('persists a new tier and reports the transition', async () => {
    await setBodyweight(70);
    // 70 * 0.5 = 35kg est1RM crosses the male novice floor exactly.
    const result = await recomputeAndPersistExerciseRank('bench-press', 35);
    expect(result).toEqual({ oldRank: 'unranked', newRank: 'novice' });
    expect(getExerciseRankState('bench-press')?.rank).toBe('novice');
  });

  it('round-trips: a second call at the same 1RM is a no-op (no re-fire)', async () => {
    await setBodyweight(70);
    await recomputeAndPersistExerciseRank('bench-press', 35);
    const second = await recomputeAndPersistExerciseRank('bench-press', 35);
    expect(second).toEqual({ oldRank: 'novice', newRank: 'novice' });
  });

  it('ratchet semantics: a lower 1RM than the achieved tier does not downgrade', async () => {
    await setBodyweight(70);
    await recomputeAndPersistExerciseRank('bench-press', 70 * 1.0); // advanced
    expect(getExerciseRankState('bench-press')?.rank).toBe('advanced');

    const lower = await recomputeAndPersistExerciseRank('bench-press', 70 * 0.5); // would be novice alone
    // newRank reported is the *recomputed* tier from this session's ratio,
    // but persistence must not have regressed — the stored state stays 'advanced'.
    expect(lower!.oldRank).toBe('advanced');
    expect(getExerciseRankState('bench-press')?.rank).toBe('advanced');
  });

  it('sex-unset uses averaged thresholds', async () => {
    await setBodyweight(70);
    expect(DEFAULT_HEALTH_PROFILE.sex).toBeNull();
    // health profile left at default (sex: null) — average of male/female novice.
    const result = await recomputeAndPersistExerciseRank('bench-press', 70 * 0.4);
    // 0.4 is above female novice (0.25) and below male novice (0.5); the
    // averaged floor is 0.375, so 0.4 should cross into novice.
    expect(result!.newRank).toBe('novice');
  });

  it('female profile uses the lower female thresholds', async () => {
    await setBodyweight(70);
    updateHealthProfile({ ...DEFAULT_HEALTH_PROFILE, sex: 'female' });
    // female bench-press novice floor is 0.25 — well below the male 0.5.
    const result = await recomputeAndPersistExerciseRank('bench-press', 70 * 0.3);
    expect(result!.newRank).toBe('novice');
  });

  it('never throws on a Supabase-unconfigured (guest) environment', async () => {
    await setBodyweight(70);
    await expect(recomputeAndPersistExerciseRank('deadlift', 100)).resolves.not.toBeUndefined();
  });
});
