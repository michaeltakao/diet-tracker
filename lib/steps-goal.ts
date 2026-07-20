/**
 * Manual step tracking — pure goal/progress math (phase D).
 * Distance is decorative flavor text, not a claim of accuracy — an average
 * stride length (~0.7m) converts steps to a rough km figure.
 */

export const STEP_GOAL_DEFAULT = 10_000;
export const MAX_STEPS = 200_000; // matches the SQL CHECK

/** Clamp a steps input into [0, MAX_STEPS]; non-finite → 0. */
export function clampSteps(steps: number): number {
  if (!Number.isFinite(steps)) return 0;
  return Math.min(MAX_STEPS, Math.max(0, Math.round(steps)));
}

export interface StepsProgress {
  steps: number;
  goal: number;
  /** 0–100, capped (a 15k day against a 10k goal still shows 100%). */
  pct: number;
  goalReached: boolean;
}

/** Progress toward the daily step goal. */
export function stepsProgress(steps: number, goal: number = STEP_GOAL_DEFAULT): StepsProgress {
  const s = clampSteps(steps);
  const g = goal > 0 ? goal : STEP_GOAL_DEFAULT;
  return {
    steps: s,
    goal: g,
    pct: Math.min(100, Math.round((s / g) * 100)),
    goalReached: s >= g,
  };
}

/** Rough distance in km from a step count (0.7 m average stride). */
export function stepsToKm(steps: number): number {
  return Math.round(clampSteps(steps) * 0.7) / 1000;
}
