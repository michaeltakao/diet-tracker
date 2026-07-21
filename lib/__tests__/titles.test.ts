/**
 * lib/titles.ts tests — evaluateTitles (pure) + awardTitle (localStorage
 * round-trip, same jsdom stub pattern as xp.test.ts / steps.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateTitles, awardTitle, TITLES, type TitleEvalContext, type TitleKey } from '../titles';

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

const ZERO_CTX: TitleEvalContext = {
  streak: 0, longestStreak: 0, mealCount: 0, workoutCount: 0, waterLogDayCount: 0, highestRank: 'E',
};

describe('evaluateTitles', () => {
  it('11 conditions are independently evaluated', () => {
    expect(TITLES).toHaveLength(11);
  });

  it('shadow_rookie is earned at the zero/E-rank starting state (granted to everyone from the start)', () => {
    const earned = evaluateTitles(ZERO_CTX, new Set());
    expect(earned.map((t) => t.key)).toContain('shadow_rookie');
  });

  it('unbroken requires a 30-day streak', () => {
    expect(evaluateTitles({ ...ZERO_CTX, streak: 29 }, new Set()).map((t) => t.key)).not.toContain('unbroken');
    expect(evaluateTitles({ ...ZERO_CTX, streak: 30 }, new Set()).map((t) => t.key)).toContain('unbroken');
  });

  it('iron_will requires a 100-day longest streak', () => {
    expect(evaluateTitles({ ...ZERO_CTX, longestStreak: 99 }, new Set()).map((t) => t.key)).not.toContain('iron_will');
    expect(evaluateTitles({ ...ZERO_CTX, longestStreak: 100 }, new Set()).map((t) => t.key)).toContain('iron_will');
  });

  it('nutrition_master requires 100 meals', () => {
    expect(evaluateTitles({ ...ZERO_CTX, mealCount: 99 }, new Set()).map((t) => t.key)).not.toContain('nutrition_master');
    expect(evaluateTitles({ ...ZERO_CTX, mealCount: 100 }, new Set()).map((t) => t.key)).toContain('nutrition_master');
  });

  it('workout_warrior requires 50 workouts', () => {
    expect(evaluateTitles({ ...ZERO_CTX, workoutCount: 49 }, new Set()).map((t) => t.key)).not.toContain('workout_warrior');
    expect(evaluateTitles({ ...ZERO_CTX, workoutCount: 50 }, new Set()).map((t) => t.key)).toContain('workout_warrior');
  });

  it('hydration_hero requires 30 water-goal days', () => {
    expect(evaluateTitles({ ...ZERO_CTX, waterLogDayCount: 29 }, new Set()).map((t) => t.key)).not.toContain('hydration_hero');
    expect(evaluateTitles({ ...ZERO_CTX, waterLogDayCount: 30 }, new Set()).map((t) => t.key)).toContain('hydration_hero');
  });

  it('shadow titles unlock progressively with highestRank (rankAtLeast semantics)', () => {
    const atC = evaluateTitles({ ...ZERO_CTX, highestRank: 'C' }, new Set()).map((t) => t.key);
    expect(atC).toEqual(expect.arrayContaining(['shadow_rookie', 'shadow_veteran', 'shadow_knight']));
    expect(atC).not.toContain('shadow_lord');
    expect(atC).not.toContain('shadow_king');
    expect(atC).not.toContain('shadow_emperor');
  });

  it('shadow_emperor requires S-rank', () => {
    const atA = evaluateTitles({ ...ZERO_CTX, highestRank: 'A' }, new Set()).map((t) => t.key);
    expect(atA).not.toContain('shadow_emperor');
    const atS = evaluateTitles({ ...ZERO_CTX, highestRank: 'S' }, new Set()).map((t) => t.key);
    expect(atS).toContain('shadow_emperor');
  });

  it('excludes titles already in alreadyEarned', () => {
    const already = new Set<TitleKey>(['shadow_rookie']);
    const earned = evaluateTitles(ZERO_CTX, already).map((t) => t.key);
    expect(earned).not.toContain('shadow_rookie');
  });

  it('returns empty when everything is already earned and no new condition is met', () => {
    const allKeys = new Set(TITLES.map((t) => t.key));
    expect(evaluateTitles(ZERO_CTX, allKeys)).toEqual([]);
  });
});

describe('awardTitle', () => {
  it('returns true on first award and persists to localStorage', async () => {
    const result = await awardTitle(null, 'shadow_rookie');
    expect(result).toBe(true);
    const raw = JSON.parse(localStorage.getItem('diet-tracker-v1')!);
    expect(raw.earnedTitles).toContain('shadow_rookie');
  });

  it('is idempotent — second award of the same title returns false, no duplicate', async () => {
    await awardTitle(null, 'shadow_rookie');
    const second = await awardTitle(null, 'shadow_rookie');
    expect(second).toBe(false);
    const raw = JSON.parse(localStorage.getItem('diet-tracker-v1')!);
    expect(raw.earnedTitles.filter((k: string) => k === 'shadow_rookie')).toHaveLength(1);
  });

  it('multiple distinct titles accumulate independently', async () => {
    await awardTitle(null, 'shadow_rookie');
    await awardTitle(null, 'unbroken');
    const raw = JSON.parse(localStorage.getItem('diet-tracker-v1')!);
    expect(raw.earnedTitles.sort()).toEqual(['shadow_rookie', 'unbroken']);
  });
});
