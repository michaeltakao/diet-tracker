import { describe, expect, it } from 'vitest';
import { computeWeekScore, type WeekScoreInput } from '@/lib/week-score';

const base: WeekScoreInput = {
  calorieCompliance: 50,
  avgProtein: 40,
  proteinGoal: 80,
  workoutDays: 2,
  waterGoalDays: 3,
  loggedDays: 6,
  streak: 7,
  fluidNeutral: false,
  proteinCapped: false,
  proteinCapG: null,
};

describe('computeWeekScore', () => {
  it('matches a hand-computed non-CKD case (original weights)', () => {
    // cal 50×.30=15, prt 50×.25=12.5, wkt 50×.25=12.5, h2o 50×.10=5, stk 100×.10=10 → 55
    expect(computeWeekScore(base)).toBe(55);
  });

  it('non-CKD: meeting the water goal still raises the score', () => {
    expect(computeWeekScore({ ...base, waterGoalDays: 6 })).toBe(60);
    expect(computeWeekScore({ ...base, waterGoalDays: 0 })).toBe(50);
  });

  it('CKD: water days have no effect on the score', () => {
    const ckd = { ...base, fluidNeutral: true };
    const none = computeWeekScore({ ...ckd, waterGoalDays: 0 });
    const all  = computeWeekScore({ ...ckd, waterGoalDays: 6 });
    expect(none).toBe(all);
    // (15 + 12.5 + 12.5 + 10) / 0.9 = 55.56 → 56
    expect(none).toBe(56);
  });

  it('CKD: a perfect week still scores 100 (weights rescaled, not a free 10)', () => {
    const perfect: WeekScoreInput = {
      calorieCompliance: 100, avgProtein: 80, proteinGoal: 80,
      workoutDays: 4, waterGoalDays: 0, loggedDays: 7, streak: 7, fluidNeutral: true,
      proteinCapped: false, proteinCapG: null,
    };
    expect(computeWeekScore(perfect)).toBe(100);
    expect(computeWeekScore({ ...perfect, fluidNeutral: false, waterGoalDays: 7 })).toBe(100);
  });

  it('CKD: an empty week is 0, not 10', () => {
    expect(computeWeekScore({
      calorieCompliance: 0, avgProtein: 0, proteinGoal: 80,
      workoutDays: 0, waterGoalDays: 0, loggedDays: 2, streak: 0, fluidNeutral: true,
      proteinCapped: false, proteinCapG: null,
    })).toBe(0);
  });

  describe('CKD protein cap (fluid-neutral + protein-capped)', () => {
    // Shared terms: cal 50×.30=15, wkt 50×.25=12.5, stk 100×.10=10; water dropped.
    const ckd: WeekScoreInput = {
      ...base, fluidNeutral: true, proteinCapped: true, proteinCapG: 58, proteinGoal: 120,
    };

    it('under the capped target → proportional credit against min(goal, cap)', () => {
      // target = min(120, 58) = 58; 29/58 = 50% → 12.5; (15+12.5+12.5+10)/0.9 = 55.56 → 56
      expect(computeWeekScore({ ...ckd, avgProtein: 29 })).toBe(56);
    });

    it('between the goal-capped target and the cap → full credit', () => {
      // goal 50 < cap 58 → target 50; avg 55 ≤ cap → 25; (15+25+12.5+10)/0.9 = 69.44 → 69
      expect(computeWeekScore({ ...ckd, proteinGoal: 50, avgProtein: 55 })).toBe(69);
      // exactly at the cap is still full credit
      expect(computeWeekScore({ ...ckd, avgProtein: 58 })).toBe(69);
    });

    it('over the cap → protein term is 0 (never rewarded)', () => {
      // the round-4 smoke case: 99 g at a 58 g cap; (15+0+12.5+10)/0.9 = 41.67 → 42
      expect(computeWeekScore({ ...ckd, avgProtein: 99 })).toBe(42);
      expect(computeWeekScore({ ...ckd, avgProtein: 58.1 })).toBe(42);
      // and strictly below a within-cap week
      expect(computeWeekScore({ ...ckd, avgProtein: 99 }))
        .toBeLessThan(computeWeekScore({ ...ckd, avgProtein: 29 }));
    });

    it('no weight → protein dropped and rescaled by 1/0.65', () => {
      // (15 + 12.5 + 10) / 0.65 = 57.69 → 58, whatever the protein intake
      const noW = { ...ckd, proteinCapG: null };
      expect(computeWeekScore({ ...noW, avgProtein: 0 })).toBe(58);
      expect(computeWeekScore({ ...noW, avgProtein: 200 })).toBe(58);
    });

    it('a perfect week is 100, with or without a known weight', () => {
      const perfect: WeekScoreInput = {
        ...ckd, calorieCompliance: 100, avgProtein: 58, workoutDays: 4, streak: 7,
      };
      expect(computeWeekScore(perfect)).toBe(100);
      expect(computeWeekScore({ ...perfect, proteinCapG: null })).toBe(100);
    });

    it('non-CKD ignores any cap value (unchanged arithmetic)', () => {
      expect(computeWeekScore({ ...base, proteinCapG: 10 })).toBe(55);
      // over-goal protein still clamps to full credit: 15+25+12.5+5+10 = 67.5 → 68
      expect(computeWeekScore({ ...base, avgProtein: 200 })).toBe(68);
    });
  });
});
