/**
 * lib/rank.ts pure-math tests. No localStorage, no clock.
 */
import { describe, it, expect } from 'vitest';
import { getRankForXp, rankAtLeast, RANKS } from '../rank';

describe('getRankForXp', () => {
  it('threshold boundaries are lower-bound inclusive', () => {
    expect(getRankForXp(0).rank).toBe('E');
    expect(getRankForXp(500).rank).toBe('D');
    expect(getRankForXp(1500).rank).toBe('C');
    expect(getRankForXp(4000).rank).toBe('B');
    expect(getRankForXp(8000).rank).toBe('A');
    expect(getRankForXp(15000).rank).toBe('S');
  });

  it('one XP below each threshold stays at the previous tier', () => {
    expect(getRankForXp(499).rank).toBe('E');
    expect(getRankForXp(1499).rank).toBe('D');
    expect(getRankForXp(3999).rank).toBe('C');
    expect(getRankForXp(7999).rank).toBe('B');
    expect(getRankForXp(14999).rank).toBe('A');
  });

  it('negative or NaN XP is clamped to 0 → E-rank', () => {
    expect(getRankForXp(-100).rank).toBe('E');
    expect(getRankForXp(NaN).rank).toBe('E');
  });

  it('nextRank/nextThreshold reflect the following tier for non-max ranks', () => {
    const e = getRankForXp(0);
    expect(e.nextRank).toBe('D');
    expect(e.nextThreshold).toBe(500);
    expect(e.currentThreshold).toBe(0);
  });

  it('S-rank (including beyond its threshold) has null nextRank/nextThreshold', () => {
    expect(getRankForXp(15000).nextRank).toBeNull();
    expect(getRankForXp(15000).nextThreshold).toBeNull();
    expect(getRankForXp(999_999).nextRank).toBeNull();
    expect(getRankForXp(999_999).rank).toBe('S');
  });

  it('description is a stable i18n-key-shaped string per rank', () => {
    expect(getRankForXp(0).description).toBe('rankDescE');
    expect(getRankForXp(15000).description).toBe('rankDescS');
  });

  it('RANKS is defined for all six tiers in ascending threshold order', () => {
    expect(RANKS.map((r) => r.rank)).toEqual(['E', 'D', 'C', 'B', 'A', 'S']);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].threshold).toBeGreaterThan(RANKS[i - 1].threshold);
    }
  });
});

describe('rankAtLeast', () => {
  it('is true when rank equals min', () => {
    expect(rankAtLeast('C', 'C')).toBe(true);
  });

  it('is true when rank exceeds min', () => {
    expect(rankAtLeast('S', 'E')).toBe(true);
  });

  it('is false when rank is below min', () => {
    expect(rankAtLeast('D', 'C')).toBe(false);
    expect(rankAtLeast('E', 'S')).toBe(false);
  });
});
