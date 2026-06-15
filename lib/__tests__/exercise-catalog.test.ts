import { describe, it, expect } from 'vitest';
import { EXERCISES_BY_PART } from '../exercise-catalog';
import type { MusclePart } from '../types';

const PARTS: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

describe('EXERCISES_BY_PART integrity', () => {
  it('defines an entry for every muscle part', () => {
    for (const part of PARTS) {
      expect(EXERCISES_BY_PART[part]).toBeDefined();
    }
    // No unexpected extra keys.
    expect(Object.keys(EXERCISES_BY_PART).sort()).toEqual([...PARTS].sort());
  });

  it('offers at least two exercises per part (real choice to tap)', () => {
    for (const part of PARTS) {
      expect(EXERCISES_BY_PART[part].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses unique, non-empty names within each part', () => {
    for (const part of PARTS) {
      const names = EXERCISES_BY_PART[part].map((e) => e.name);
      for (const name of names) expect(name.trim().length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('keeps every default within clamp bounds (weight >= 0, reps/sets >= 1)', () => {
    for (const part of PARTS) {
      for (const ex of EXERCISES_BY_PART[part]) {
        expect(Number.isFinite(ex.defaultWeight)).toBe(true);
        expect(ex.defaultWeight).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(ex.defaultReps)).toBe(true);
        expect(ex.defaultReps).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(ex.defaultSets)).toBe(true);
        expect(ex.defaultSets).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('pairs an English coach tip with every Japanese one (no half-localized tips)', () => {
    for (const part of PARTS) {
      for (const ex of EXERCISES_BY_PART[part]) {
        if (ex.coachTip) expect(ex.coachTipEn, `${ex.name} missing coachTipEn`).toBeTruthy();
      }
    }
  });
});
