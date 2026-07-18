import { describe, it, expect } from 'vitest';
import { sumSodiumFiber, sodiumMgToSaltG, saltTargetG, fiberTargetG } from '@/lib/micros';

describe('sumSodiumFiber', () => {
  it('sums only entries that carry data and counts them', () => {
    const s = sumSodiumFiber([
      { sodiumMg: 400, fiberG: 2.3 },
      { sodiumMg: 150 },              // sodium only
      { fiberG: 1.2 },                // fiber only
      {},                             // no data — not counted
      { sodiumMg: undefined, fiberG: undefined },
    ]);
    expect(s.sodiumMg).toBe(550);
    expect(s.fiberG).toBe(3.5);
    expect(s.entriesWithData).toBe(3);
  });

  it('returns zeros for an all-missing day (display must hide)', () => {
    expect(sumSodiumFiber([{}, {}])).toEqual({ sodiumMg: 0, fiberG: 0, entriesWithData: 0 });
    expect(sumSodiumFiber([])).toEqual({ sodiumMg: 0, fiberG: 0, entriesWithData: 0 });
  });

  it('treats explicit 0 as data (0 ≠ unknown)', () => {
    const s = sumSodiumFiber([{ sodiumMg: 0 }]);
    expect(s.entriesWithData).toBe(1);
    expect(s.sodiumMg).toBe(0);
  });

  it('rounds: sodium to whole mg, fiber to 1 decimal', () => {
    const s = sumSodiumFiber([{ sodiumMg: 100.6, fiberG: 1.24 }, { fiberG: 1.13 }]);
    expect(s.sodiumMg).toBe(101);
    expect(s.fiberG).toBe(2.4);
  });
});

describe('sodiumMgToSaltG', () => {
  it('converts mg sodium to g salt equivalent (×2.54 / 1000)', () => {
    expect(sodiumMgToSaltG(1000)).toBe(2.5);  // 2.54 → 2.5 at 1 decimal
    expect(sodiumMgToSaltG(0)).toBe(0);
    expect(sodiumMgToSaltG(2953)).toBe(7.5);  // ≈ the male upper target
  });
});

describe('targets (厚労省 目標量)', () => {
  it('sex-specific values', () => {
    expect(saltTargetG('male')).toBe(7.5);
    expect(saltTargetG('female')).toBe(6.5);
    expect(fiberTargetG('male')).toBe(21);
    expect(fiberTargetG('female')).toBe(18);
  });

  it('sex unset → mean (matches nutrition-standards convention)', () => {
    expect(saltTargetG(null)).toBe(7);
    expect(saltTargetG(undefined)).toBe(7);
    expect(fiberTargetG(null)).toBe(19.5);
  });
});
