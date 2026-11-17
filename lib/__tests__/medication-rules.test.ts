import { describe, expect, it } from 'vitest';
import {
  buildHealthContextPrompt,
  getNutritionWarnings,
  getWorkoutWarnings,
  CKD_FLUID_GUIDANCE,
  CKD_FLUID_PROMPT,
  isFluidNeutral,
} from '@/lib/medication-rules';

describe('CKD fluid policy (neutral: follow doctor)', () => {
  it('injects the fluid instruction into the AI health context for CKD', () => {
    expect(buildHealthContextPrompt(['腎臓病'], [])).toContain(CKD_FLUID_PROMPT);
    expect(buildHealthContextPrompt(['腎臓病', '高血圧'], ['アムロジピン'])).toContain(CKD_FLUID_PROMPT);
  });

  it('adds nothing for users without CKD', () => {
    expect(buildHealthContextPrompt([], [])).toBe('');
    expect(buildHealthContextPrompt(['高血圧'], [])).not.toContain(CKD_FLUID_PROMPT);
  });

  it('no longer tells CKD users to push fluids during workouts', () => {
    const w = getWorkoutWarnings(['腎臓病'], []);
    expect(w.some(x => x.includes('水分補給を徹底'))).toBe(false);
    expect(w).toContain(CKD_FLUID_GUIDANCE);
  });

  it('surfaces the guidance on the nutrition side (/add)', () => {
    expect(getNutritionWarnings(['腎臓病'], [])).toContain(CKD_FLUID_GUIDANCE);
  });

  it('the user-facing text never asks for more or less water', () => {
    expect(CKD_FLUID_GUIDANCE).toContain('主治医の指示に従って');
    expect(CKD_FLUID_GUIDANCE).not.toMatch(/徹底|多め|控え/);
  });
});

describe('isFluidNeutral', () => {
  it('is true only for the CKD chip value', () => {
    expect(isFluidNeutral(['腎臓病'])).toBe(true);
    expect(isFluidNeutral(['高血圧', '腎臓病'])).toBe(true);
    expect(isFluidNeutral(['高血圧'])).toBe(false);
    expect(isFluidNeutral([])).toBe(false);
  });
});
