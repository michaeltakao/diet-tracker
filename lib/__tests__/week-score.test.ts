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
    };
    expect(computeWeekScore(perfect)).toBe(100);
    expect(computeWeekScore({ ...perfect, fluidNeutral: false, waterGoalDays: 7 })).toBe(100);
  });

  it('CKD: an empty week is 0, not 10', () => {
    expect(computeWeekScore({
      calorieCompliance: 0, avgProtein: 0, proteinGoal: 80,
      workoutDays: 0, waterGoalDays: 0, loggedDays: 2, streak: 0, fluidNeutral: true,
    })).toBe(0);
  });
});
