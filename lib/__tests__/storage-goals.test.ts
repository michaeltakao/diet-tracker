import { describe, it, expect } from 'vitest';
import { DEFAULT_GOALS, goalsEqualDefaults } from '../storage';
import type { DailyGoals } from '../types';

describe('goalsEqualDefaults', () => {
  it('matches the exact fresh-install defaults', () => {
    expect(goalsEqualDefaults({ ...DEFAULT_GOALS })).toBe(true);
  });

  it('returns false when any single field differs from the defaults', () => {
    const fields: Array<keyof DailyGoals> = ['calories', 'protein', 'fat', 'carbs', 'water'];
    for (const field of fields) {
      const perturbed: DailyGoals = { ...DEFAULT_GOALS, [field]: (DEFAULT_GOALS[field] as number) + 1 };
      expect(goalsEqualDefaults(perturbed), `perturbed ${field}`).toBe(false);
    }
  });

  it('ignores goalWeight — a set goalWeight alone does not make goals "real"', () => {
    expect(goalsEqualDefaults({ ...DEFAULT_GOALS, goalWeight: 65 })).toBe(true);
  });
});
