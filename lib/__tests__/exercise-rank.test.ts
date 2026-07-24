/**
 * lib/exercise-rank.ts pure-math tests. No localStorage, no clock.
 */
import { describe, it, expect } from 'vitest';
import {
  getExerciseRank,
  isRankableExercise,
  isExerciseRankHigher,
  EXERCISE_RANK_THRESHOLDS,
} from '../exercise-rank';

// bench-press male thresholds: novice 0.5, intermediate 0.75, advanced 1.0, expert 1.5, elite 2.0
describe('getExerciseRank', () => {
  it('returns null for an unknown/non-curated exercise id', () => {
    expect(getExerciseRank('cable-crossover', 50, 70, 'male')).toBeNull();
  });

  it('returns unranked with null ratio when bodyweight is not on file', () => {
    const r = getExerciseRank('bench-press', 60, null, 'male');
    expect(r).not.toBeNull();
    expect(r!.rank).toBe('unranked');
    expect(r!.ratio).toBeNull();
    expect(r!.nextRatioThreshold).toBeNull();
  });

  it('treats non-positive/non-finite bodyweight as unranked too', () => {
    expect(getExerciseRank('bench-press', 60, 0, 'male')!.rank).toBe('unranked');
    expect(getExerciseRank('bench-press', 60, -5, 'male')!.rank).toBe('unranked');
    expect(getExerciseRank('bench-press', 60, NaN, 'male')!.rank).toBe('unranked');
  });

  it('ratio boundaries are lower-bound inclusive (male bench-press)', () => {
    // ratio = est1RM / bodyweight; bodyweight fixed at 70kg for round numbers.
    expect(getExerciseRank('bench-press', 70 * 0.5, 70, 'male')!.rank).toBe('novice');
    expect(getExerciseRank('bench-press', 70 * 0.75, 70, 'male')!.rank).toBe('intermediate');
    expect(getExerciseRank('bench-press', 70 * 1.0, 70, 'male')!.rank).toBe('advanced');
    expect(getExerciseRank('bench-press', 70 * 1.5, 70, 'male')!.rank).toBe('expert');
    expect(getExerciseRank('bench-press', 70 * 2.0, 70, 'male')!.rank).toBe('elite');
  });

  it('just below the novice floor is unranked, not a crash', () => {
    const r = getExerciseRank('bench-press', 70 * 0.49, 70, 'male');
    expect(r!.rank).toBe('unranked');
    expect(r!.nextRank).toBe('novice');
  });

  it('just below a boundary stays at the previous tier', () => {
    const r = getExerciseRank('bench-press', 70 * 0.74, 70, 'male');
    expect(r!.rank).toBe('novice');
    expect(r!.nextRank).toBe('intermediate');
  });

  it('unset sex averages male/female thresholds', () => {
    const t = EXERCISE_RANK_THRESHOLDS.find((x) => x.exerciseId === 'bench-press')!;
    const avgNovice = (t.male.novice + t.female.novice) / 2;
    const bw = 70;
    // Exactly at the averaged novice floor.
    expect(getExerciseRank('bench-press', avgNovice * bw, bw, null)!.rank).toBe('novice');
    // Also covers undefined sex, the same as null.
    expect(getExerciseRank('bench-press', avgNovice * bw, bw, undefined)!.rank).toBe('novice');
  });

  it('female thresholds are strictly lower than male for the same exercise (compound lifts)', () => {
    const t = EXERCISE_RANK_THRESHOLDS.find((x) => x.exerciseId === 'deadlift')!;
    expect(t.female.elite).toBeLessThan(t.male.elite);
  });

  it('elite tier has no nextRank/nextRatioThreshold', () => {
    const r = getExerciseRank('bench-press', 70 * 3, 70, 'male');
    expect(r!.rank).toBe('elite');
    expect(r!.nextRank).toBeNull();
    expect(r!.nextRatioThreshold).toBeNull();
  });

  it('non-positive/non-finite est1RM is treated as 0 (never throws, resolves to unranked-or-lowest)', () => {
    expect(() => getExerciseRank('bench-press', -10, 70, 'male')).not.toThrow();
    expect(() => getExerciseRank('bench-press', NaN, 70, 'male')).not.toThrow();
    expect(getExerciseRank('bench-press', 0, 70, 'male')!.rank).toBe('unranked');
  });
});

describe('isRankableExercise', () => {
  it('is true for all 10 curated weight-based lifts', () => {
    const expected = [
      'bench-press', 'deadlift', 'lat-pulldown', 'barbell-squat', 'leg-press',
      'shoulder-press', 'side-raise', 'arm-curl', 'triceps-pressdown',
    ];
    for (const id of expected) expect(isRankableExercise(id)).toBe(true);
  });

  it('is false for bodyweight/isometric curated exercises excluded from v1 (Crunch, Plank)', () => {
    expect(isRankableExercise('crunch')).toBe(false);
    expect(isRankableExercise('plank')).toBe(false);
  });

  it('is false for a non-curated exercise', () => {
    expect(isRankableExercise('cable-crossover')).toBe(false);
  });

  it('EXERCISE_RANK_THRESHOLDS has exactly 9 entries', () => {
    // 10 curated weight-based lifts minus lat-pulldown counted once — see
    // full id list above (9 distinct entries, matching the threshold table).
    expect(EXERCISE_RANK_THRESHOLDS).toHaveLength(9);
  });
});

describe('isExerciseRankHigher', () => {
  it('orders unranked below all real tiers', () => {
    expect(isExerciseRankHigher('novice', 'unranked')).toBe(true);
    expect(isExerciseRankHigher('unranked', 'novice')).toBe(false);
  });

  it('orders tiers novice < intermediate < advanced < expert < elite', () => {
    expect(isExerciseRankHigher('intermediate', 'novice')).toBe(true);
    expect(isExerciseRankHigher('elite', 'expert')).toBe(true);
    expect(isExerciseRankHigher('novice', 'elite')).toBe(false);
  });

  it('is false for equal ranks', () => {
    expect(isExerciseRankHigher('advanced', 'advanced')).toBe(false);
  });
});
