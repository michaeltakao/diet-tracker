/**
 * lib/daily-challenge.ts pure-logic tests. No localStorage, no clock —
 * `date` is passed explicitly (same pattern as daily-quests.test.ts); the
 * JST-day boundary is the caller's responsibility (jstToday()).
 */
import { describe, it, expect } from 'vitest';
import {
  CHALLENGE_POOL,
  DAILY_CHALLENGE_XP,
  countChallengeReps,
  getChallengeForDate,
  getDailyChallengeProgress,
  hashDate,
  type ChallengeType,
} from '../daily-challenge';
import { shiftDate } from '../streak';
import type { SetDetail, WorkoutEntry } from '../types';

const TODAY = '2026-07-20';
const YESTERDAY = '2026-07-19';

function workout(
  name: string,
  date: string,
  opts: { reps?: number; sets?: number; setDetails?: SetDetail[] } = {},
): WorkoutEntry {
  return {
    id: crypto.randomUUID(),
    date,
    name,
    category: 'strength',
    weight: 0,
    reps: opts.reps ?? 10,
    sets: opts.sets ?? 3,
    ...(opts.setDetails ? { setDetails: opts.setDetails } : {}),
    addedAt: new Date().toISOString(),
  };
}

const SQUAT_DEF = CHALLENGE_POOL.find((c) => c.type === 'squat_150')!;
const PLANK_DEF = CHALLENGE_POOL.find((c) => c.type === 'plank_180')!;
const BURPEE_DEF = CHALLENGE_POOL.find((c) => c.type === 'burpee_50')!;

describe('getChallengeForDate', () => {
  it('is deterministic: the same date always yields the same pick', () => {
    expect(getChallengeForDate(TODAY)).toBe(getChallengeForDate(TODAY));
    expect(getChallengeForDate('2026-01-01')).toBe(getChallengeForDate('2026-01-01'));
  });

  it('covers all 6 challenge types across 366 consecutive dates', () => {
    const seen = new Set<ChallengeType>();
    let d = '2026-01-01';
    for (let i = 0; i < 366; i++, d = shiftDate(d, 1)) {
      seen.add(getChallengeForDate(d).type);
    }
    expect(seen.size).toBe(CHALLENGE_POOL.length);
  });

  it('hashDate is never negative', () => {
    let d = '2026-01-01';
    for (let i = 0; i < 366; i++, d = shiftDate(d, 1)) {
      expect(hashDate(d)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('countChallengeReps — matching', () => {
  it('matches weighted variants by substring (generous by design)', () => {
    const entries = [workout('バーベルスクワット', TODAY, { reps: 10, sets: 3 })];
    expect(countChallengeReps(entries, SQUAT_DEF, TODAY)).toBe(30);
  });

  it('matches case-insensitively in English', () => {
    expect(countChallengeReps([workout('Squat', TODAY, { reps: 5, sets: 2 })], SQUAT_DEF, TODAY)).toBe(10);
    expect(countChallengeReps([workout('BURPEE', TODAY, { reps: 5, sets: 2 })], BURPEE_DEF, TODAY)).toBe(10);
  });

  it('does not match unrelated exercises', () => {
    expect(countChallengeReps([workout('ベンチプレス', TODAY)], SQUAT_DEF, TODAY)).toBe(0);
  });

  it("excludes yesterday's entries", () => {
    expect(countChallengeReps([workout('スクワット', YESTERDAY)], SQUAT_DEF, TODAY)).toBe(0);
  });
});

describe('countChallengeReps — counting', () => {
  it('uses reps × sets for scalar entries', () => {
    expect(countChallengeReps([workout('スクワット', TODAY, { reps: 20, sets: 3 })], SQUAT_DEF, TODAY)).toBe(60);
  });

  it('sums setDetails reps when present (scalar reps is top-set only)', () => {
    const entries = [workout('スクワット', TODAY, {
      reps: 12, sets: 2,
      setDetails: [{ weight: 0, reps: 12 }, { weight: 0, reps: 10 }],
    })];
    expect(countChallengeReps(entries, SQUAT_DEF, TODAY)).toBe(22);
  });

  it('sums across a mix of scalar and per-set entries', () => {
    const entries = [
      workout('スクワット', TODAY, { reps: 20, sets: 3 }),
      workout('squat jump', TODAY, { setDetails: [{ weight: 0, reps: 15 }] }),
    ];
    expect(countChallengeReps(entries, SQUAT_DEF, TODAY)).toBe(75);
  });
});

describe('getDailyChallengeProgress', () => {
  it('plank reps count as seconds: 60 × 3 = 180 completes plank_180', () => {
    const entries = [workout('プランク', TODAY, { reps: 60, sets: 3 })];
    const current = countChallengeReps(entries, PLANK_DEF, TODAY);
    expect(current).toBe(180);
    expect(current >= PLANK_DEF.target).toBe(true);
  });

  it('completes exactly at the target boundary', () => {
    // Pick whatever challenge TODAY hashes to and hit its target exactly.
    const def = getChallengeForDate(TODAY);
    const entries = [workout(def.keywords[0], TODAY, { reps: def.target, sets: 1 })];
    const p = getDailyChallengeProgress(entries, TODAY);
    expect(p.challenge.type).toBe(def.type);
    expect(p.current).toBe(def.target);
    expect(p.completed).toBe(true);
  });

  it('is incomplete one rep below the target', () => {
    const def = getChallengeForDate(TODAY);
    const entries = [workout(def.keywords[0], TODAY, { reps: def.target - 1, sets: 1 })];
    expect(getDailyChallengeProgress(entries, TODAY).completed).toBe(false);
  });

  it('exposes the fixed XP amount', () => {
    expect(DAILY_CHALLENGE_XP).toBe(30);
  });
});
