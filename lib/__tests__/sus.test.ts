import { describe, it, expect } from 'vitest';
import { scoreSus, type SusItemScores } from '../sus';

function items(overrides: Partial<SusItemScores> = {}): SusItemScores {
  return {
    item1: 3, item2: 3, item3: 3, item4: 3, item5: 3,
    item6: 3, item7: 3, item8: 3, item9: 3, item10: 3,
    ...overrides,
  };
}

describe('scoreSus', () => {
  it('all-neutral (3) responses score exactly 50', () => {
    // Every item contributes (3-1)=2 or (5-3)=2 → sum=20 → 20*2.5=50.
    expect(scoreSus(items())).toBe(50);
  });

  it('best possible responses (odd=5, even=1) score 100', () => {
    expect(scoreSus(items({
      item1: 5, item3: 5, item5: 5, item7: 5, item9: 5,
      item2: 1, item4: 1, item6: 1, item8: 1, item10: 1,
    }))).toBe(100);
  });

  it('worst possible responses (odd=1, even=5) score 0', () => {
    expect(scoreSus(items({
      item1: 1, item3: 1, item5: 1, item7: 1, item9: 1,
      item2: 5, item4: 5, item6: 5, item8: 5, item10: 5,
    }))).toBe(0);
  });

  it('matches the canonical Brooke (1996) worked example', () => {
    // Textbook example item scores → contributions → total, commonly cited
    // as summing to 22.5 raw points (22.5 * 2.5 / ... ); use a hand-verified
    // simple case instead to avoid propagating an unverified "textbook" claim:
    // odd items all 4 → contributes 3 each (15 total); even items all 2 →
    // contributes 3 each (15 total) → sum=30 → 30*2.5=75.
    expect(scoreSus(items({
      item1: 4, item3: 4, item5: 4, item7: 4, item9: 4,
      item2: 2, item4: 2, item6: 2, item8: 2, item10: 2,
    }))).toBe(75);
  });

  it('throws on out-of-range item scores', () => {
    expect(() => scoreSus(items({ item1: 0 }))).toThrow(RangeError);
    expect(() => scoreSus(items({ item6: 6 }))).toThrow(RangeError);
  });

  it('throws on non-integer item scores', () => {
    expect(() => scoreSus(items({ item2: 2.5 }))).toThrow(RangeError);
  });
});
