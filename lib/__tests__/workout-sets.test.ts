import { describe, it, expect } from 'vitest';
import { summarizeSets, nextSetSuggestion, comboBonusXp } from '@/lib/workout-sets';

describe('summarizeSets', () => {
  it('summarizes: top weight, its reps, count, volume, best 1RM', () => {
    const s = summarizeSets([
      { weight: 60, reps: 10 },
      { weight: 65, reps: 8 },
      { weight: 65, reps: 6 },
    ]);
    expect(s.sets).toBe(3);
    expect(s.weight).toBe(65);
    expect(s.reps).toBe(8); // FIRST set at the top weight
    expect(s.volume).toBe(60 * 10 + 65 * 8 + 65 * 6);
    // Epley: 65×(1+8/30) = 82.3 > 60×(1+10/30) = 80 > 65×(1+6/30) = 78
    expect(s.best1RM).toBe(82.3);
  });

  it('handles the 1RM tie: single-rep set is its own 1RM', () => {
    const s = summarizeSets([
      { weight: 100, reps: 1 },  // 1RM = 100 by definition
      { weight: 80, reps: 8 },   // Epley 101.3 — beats the true single
    ]);
    expect(s.weight).toBe(100);
    expect(s.best1RM).toBe(101.3);
  });

  it('returns zeros for empty input', () => {
    expect(summarizeSets([])).toEqual({ sets: 0, reps: 0, weight: 0, volume: 0, best1RM: 0 });
  });

  it('drops invalid sets (NaN, negative weight, zero reps) but keeps bodyweight', () => {
    const s = summarizeSets([
      { weight: NaN, reps: 10 },
      { weight: -5, reps: 10 },
      { weight: 20, reps: 0 },
      { weight: 0, reps: 15 },  // bodyweight — valid
    ]);
    expect(s.sets).toBe(1);
    expect(s.weight).toBe(0);
    expect(s.reps).toBe(15);
    expect(s.volume).toBe(0);
    expect(s.best1RM).toBe(0); // epley1RM returns 0 for weight ≤ 0
  });
});

describe('nextSetSuggestion', () => {
  it('adds 2.5 kg after ≥12 reps at the previous weight', () => {
    expect(nextSetSuggestion({ weight: 40, reps: 12 })).toEqual({ weight: 42.5, reps: 12 });
    expect(nextSetSuggestion({ weight: 40, reps: 15 })).toEqual({ weight: 42.5, reps: 15 });
  });

  it('repeats the weight below 12 reps', () => {
    expect(nextSetSuggestion({ weight: 40, reps: 10 })).toEqual({ weight: 40, reps: 10 });
  });

  it('falls back when no history or bodyweight', () => {
    expect(nextSetSuggestion(null, 40)).toEqual({ weight: 40, reps: 10 });
    expect(nextSetSuggestion({ weight: 0, reps: 15 }, 0)).toEqual({ weight: 0, reps: 15 });
  });
});

describe('comboBonusXp', () => {
  it('awards fast-tier XP up to and including 60s', () => {
    expect(comboBonusXp(0)).toBe(5);
    expect(comboBonusXp(59_999)).toBe(5);
    expect(comboBonusXp(60_000)).toBe(5);
  });

  it('awards slow-tier XP between 60s and 120s inclusive', () => {
    expect(comboBonusXp(60_001)).toBe(3);
    expect(comboBonusXp(120_000)).toBe(3);
  });

  it('awards no XP beyond 120s (combo broken)', () => {
    expect(comboBonusXp(120_001)).toBe(0);
  });

  it('treats negative or non-finite elapsed time as no bonus', () => {
    expect(comboBonusXp(-1)).toBe(0);
    expect(comboBonusXp(NaN)).toBe(0);
  });
});
