import { describe, it, expect } from 'vitest';
import { plannedExerciseDefaults, getSessionProgress } from '../session-progress';

describe('plannedExerciseDefaults', () => {
  it('prefers the plan target weight over the catalog fallback', () => {
    expect(plannedExerciseDefaults({ sets: 4, repsMin: 6, targetWeight: 60 }, 40))
      .toEqual({ defaultWeight: 60, defaultReps: 6, defaultSets: 4 });
  });

  it('falls back to the catalog weight when no target is set', () => {
    expect(plannedExerciseDefaults({ sets: 3, repsMin: 8, targetWeight: undefined }, 40))
      .toEqual({ defaultWeight: 40, defaultReps: 8, defaultSets: 3 });
  });

  it('falls back to 0 when neither target nor catalog weight exists', () => {
    expect(plannedExerciseDefaults({ sets: 3, repsMin: 15 }))
      .toEqual({ defaultWeight: 0, defaultReps: 15, defaultSets: 3 });
  });

  it('takes reps from repsMin and sets from the plan', () => {
    expect(plannedExerciseDefaults({ sets: 5, repsMin: 5, targetWeight: 100 }))
      .toEqual({ defaultWeight: 100, defaultReps: 5, defaultSets: 5 });
  });
});

describe('getSessionProgress', () => {
  it('flags logged exercises and counts the distinct total', () => {
    const p = getSessionProgress(['A', 'B', 'C'], ['B']);
    expect(p.doneByName).toEqual({ A: false, B: true, C: false });
    expect(p.doneCount).toBe(1);
    expect(p.total).toBe(3);
    expect(p.complete).toBe(false);
  });

  it('reports complete when every planned exercise is logged', () => {
    const p = getSessionProgress(['A', 'B'], ['A', 'B', 'X']);
    expect(p.doneCount).toBe(2);
    expect(p.total).toBe(2);
    expect(p.complete).toBe(true);
  });

  it('collapses a duplicate planned name to a single slot', () => {
    const p = getSessionProgress(['A', 'A', 'B'], ['A']);
    expect(p.total).toBe(2);
    expect(p.doneCount).toBe(1);
    expect(p.doneByName).toEqual({ A: true, B: false });
  });

  it('ignores logged names that are not in the plan', () => {
    const p = getSessionProgress(['A'], ['A', 'B', 'C']);
    expect(p.total).toBe(1);
    expect(p.doneCount).toBe(1);
    expect(p.complete).toBe(true);
  });

  it('treats an empty session as not complete', () => {
    expect(getSessionProgress([], ['A']))
      .toEqual({ doneByName: {}, doneCount: 0, total: 0, complete: false });
  });

  it('treats unlogged exercises as not done', () => {
    const p = getSessionProgress(['A', 'B'], []);
    expect(p.doneByName).toEqual({ A: false, B: false });
    expect(p.doneCount).toBe(0);
    expect(p.complete).toBe(false);
  });
});
