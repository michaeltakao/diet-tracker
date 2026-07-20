import { describe, it, expect } from 'vitest';
import { clampSteps, stepsProgress, stepsToKm, STEP_GOAL_DEFAULT, MAX_STEPS } from '@/lib/steps-goal';

describe('clampSteps', () => {
  it('clamps into [0, MAX_STEPS] and rounds', () => {
    expect(clampSteps(-5)).toBe(0);
    expect(clampSteps(500.6)).toBe(501);
    expect(clampSteps(MAX_STEPS + 100)).toBe(MAX_STEPS);
    expect(clampSteps(NaN)).toBe(0);
    expect(clampSteps(Infinity)).toBe(0);
  });
});

describe('stepsProgress', () => {
  it('computes pct and goalReached against the default goal', () => {
    const p = stepsProgress(5000);
    expect(p).toEqual({ steps: 5000, goal: STEP_GOAL_DEFAULT, pct: 50, goalReached: false });
  });

  it('caps pct at 100 when steps exceed goal', () => {
    const p = stepsProgress(15000, 10000);
    expect(p.pct).toBe(100);
    expect(p.goalReached).toBe(true);
  });

  it('falls back to the default goal for non-positive goal input', () => {
    expect(stepsProgress(1000, 0).goal).toBe(STEP_GOAL_DEFAULT);
    expect(stepsProgress(1000, -5).goal).toBe(STEP_GOAL_DEFAULT);
  });

  it('handles zero steps', () => {
    expect(stepsProgress(0)).toEqual({ steps: 0, goal: STEP_GOAL_DEFAULT, pct: 0, goalReached: false });
  });
});

describe('stepsToKm', () => {
  it('converts using the 0.7m average stride', () => {
    expect(stepsToKm(10000)).toBe(7);
    expect(stepsToKm(1428)).toBe(1); // 1428×0.7=999.6m → rounds to 1000m=1km
    expect(stepsToKm(0)).toBe(0);
  });
});
