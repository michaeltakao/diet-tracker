import { describe, it, expect } from 'vitest';
import {
  orderByRecency,
  suggestWeight,
  resolveInitialSetValues,
  type ExerciseHistoryItem,
} from '../workout-order';

/** Minimal catalog-like fixture (only `name` matters for ordering). */
const catalog = [
  { name: 'A' },
  { name: 'B' },
  { name: 'C' },
  { name: 'D' },
];

describe('orderByRecency', () => {
  it('returns the catalog unchanged (by name) when there is no history', () => {
    expect(orderByRecency(catalog, []).map((e) => e.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('floats trained exercises to the front, most-recent first', () => {
    const history: ExerciseHistoryItem[] = [
      { name: 'C', date: '2026-06-10' },
      { name: 'A', date: '2026-06-12' },
    ];
    // A (06-12) before C (06-10); untrained B, D follow in catalog order.
    expect(orderByRecency(catalog, history).map((e) => e.name)).toEqual(['A', 'C', 'B', 'D']);
  });

  it('collapses duplicate history entries to the most recent date', () => {
    const history: ExerciseHistoryItem[] = [
      { name: 'B', date: '2026-06-01' },
      { name: 'B', date: '2026-06-14' }, // newer wins
      { name: 'D', date: '2026-06-13' },
    ];
    expect(orderByRecency(catalog, history).map((e) => e.name)).toEqual(['B', 'D', 'A', 'C']);
  });

  it('breaks ties on equal dates using catalog order (stable)', () => {
    const history: ExerciseHistoryItem[] = [
      { name: 'D', date: '2026-06-14' },
      { name: 'B', date: '2026-06-14' },
    ];
    // Same date → original catalog order B before D.
    expect(orderByRecency(catalog, history).map((e) => e.name)).toEqual(['B', 'D', 'A', 'C']);
  });

  it('ignores history names that are not in the catalog', () => {
    const history: ExerciseHistoryItem[] = [
      { name: 'ZZZ-custom', date: '2026-06-14' },
      { name: 'C', date: '2026-06-10' },
    ];
    expect(orderByRecency(catalog, history).map((e) => e.name)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('does not mutate its inputs', () => {
    const cat = [{ name: 'X' }, { name: 'Y' }];
    const hist: ExerciseHistoryItem[] = [{ name: 'Y', date: '2026-06-14' }];
    const catCopy = JSON.stringify(cat);
    const histCopy = JSON.stringify(hist);
    orderByRecency(cat, hist);
    expect(JSON.stringify(cat)).toBe(catCopy);
    expect(JSON.stringify(hist)).toBe(histCopy);
  });
});

describe('suggestWeight (progressive overload)', () => {
  it('falls back to the default when there is no history', () => {
    expect(suggestWeight(null, 40)).toBe(40);
  });

  it('falls back to the default for a bodyweight/zero-load last session', () => {
    expect(suggestWeight({ weight: 0, reps: 30 }, 0)).toBe(0);
    expect(suggestWeight({ weight: 0, reps: 30 }, 20)).toBe(20);
  });

  it('adds 2.5 kg when the last session reached >= 12 reps', () => {
    expect(suggestWeight({ weight: 60, reps: 12 }, 40)).toBe(62.5);
  });

  it('repeats the load when the last session was under 12 reps', () => {
    expect(suggestWeight({ weight: 60, reps: 8 }, 40)).toBe(60);
  });
});

describe('resolveInitialSetValues (prefill resolver)', () => {
  const def = { defaultWeight: 40, defaultReps: 10, defaultSets: 3 };

  it('uses catalog defaults when there is no history', () => {
    expect(resolveInitialSetValues(def, null)).toEqual({ weight: 40, reps: 10, sets: 3 });
  });

  it('repeats last reps/sets and holds weight under 12 reps', () => {
    expect(resolveInitialSetValues(def, { weight: 60, reps: 8, sets: 4 }))
      .toEqual({ weight: 60, reps: 8, sets: 4 });
  });

  it('applies progressive overload to weight when last reps >= 12', () => {
    expect(resolveInitialSetValues(def, { weight: 60, reps: 12, sets: 3 }))
      .toEqual({ weight: 62.5, reps: 12, sets: 3 });
  });

  it('prefills reps/sets for a bodyweight move while weight stays at the default', () => {
    const bw = { defaultWeight: 0, defaultReps: 30, defaultSets: 3 };
    expect(resolveInitialSetValues(bw, { weight: 0, reps: 45, sets: 4 }))
      .toEqual({ weight: 0, reps: 45, sets: 4 });
  });
});
