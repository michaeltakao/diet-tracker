import { describe, it, expect } from 'vitest';
import { epley1RM, best1RM } from '../onerm';
import { kgToLbs, lbsToKg, toDisplay, formatWeight } from '../units';

describe('epley1RM', () => {
  it('returns the weight unchanged for a single rep', () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it('applies the Epley formula for multi-rep sets', () => {
    // 100 * (1 + 10/30) = 133.33… → 133.3
    expect(epley1RM(100, 10)).toBeCloseTo(133.3, 1);
    // 60 * (1 + 5/30) = 70
    expect(epley1RM(60, 5)).toBe(70);
  });

  it('returns 0 for non-positive or invalid input', () => {
    expect(epley1RM(0, 10)).toBe(0);
    expect(epley1RM(50, 0)).toBe(0);
    expect(epley1RM(-5, 5)).toBe(0);
    expect(epley1RM(NaN, 5)).toBe(0);
  });
});

describe('best1RM', () => {
  it('returns the highest estimate across sets', () => {
    const sets = [
      { weight: 60, reps: 10 }, // 80
      { weight: 80, reps: 3 },  // 88
      { weight: 100, reps: 1 }, // 100
    ];
    expect(best1RM(sets)).toBe(100);
  });

  it('returns 0 for an empty list', () => {
    expect(best1RM([])).toBe(0);
  });
});

describe('weight unit conversion', () => {
  it('round-trips kg <-> lbs', () => {
    expect(kgToLbs(0)).toBe(0);
    expect(lbsToKg(kgToLbs(100))).toBeCloseTo(100, 6);
  });

  it('converts a known value', () => {
    // 100 kg ≈ 220.46 lbs
    expect(kgToLbs(100)).toBeCloseTo(220.5, 1);
  });

  it('toDisplay keeps kg as-is and rounds to 0.1', () => {
    expect(toDisplay(60, 'kg')).toBe(60);
    expect(toDisplay(60, 'lbs')).toBeCloseTo(132.3, 1);
  });

  it('formatWeight trims trailing .0 and appends the unit', () => {
    expect(formatWeight(60, 'kg')).toBe('60 kg');
    expect(formatWeight(60, 'lbs')).toBe('132.3 lbs');
  });
});
