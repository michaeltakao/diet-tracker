import { describe, expect, it } from 'vitest';
import {
  buildHealthContextPrompt,
  getNutritionWarnings,
  getWorkoutWarnings,
  CKD_FLUID_GUIDANCE,
  CKD_FLUID_PROMPT,
  isFluidNeutral,
  ckdProteinCapG,
  parseWeightKg,
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

describe('CKD protein cap', () => {
  it('computes 0.8 g/kg rounded, null without a usable weight', () => {
    expect(ckdProteinCapG(72)).toBe(58);
    expect(ckdProteinCapG(60)).toBe(48);
    expect(ckdProteinCapG(null)).toBeNull();
    expect(ckdProteinCapG(undefined)).toBeNull();
    expect(ckdProteinCapG(0)).toBeNull();
  });

  it('puts the gram cap into the AI health context when weight is known', () => {
    const ctx = buildHealthContextPrompt(['腎臓病'], [], 72);
    expect(ctx).toContain('タンパク質は1日 58g');
    expect(ctx).toContain('上限を超える摂取を勧めない');
  });

  it('falls back to per-kg wording when weight is unknown', () => {
    const ctx = buildHealthContextPrompt(['腎臓病'], []);
    expect(ctx).toContain('体重1kgあたり0.8g以下');
    expect(ctx).toContain('主治医の指示');
    expect(buildHealthContextPrompt(['腎臓病'], [], null)).toBe(ctx);
  });

  it('adds no protein line for users without CKD', () => {
    expect(buildHealthContextPrompt(['高血圧'], [], 72)).not.toContain('タンパク質');
    expect(buildHealthContextPrompt(['糖尿病'], ['メトホルミン'])).not.toContain('腎臓病のためタンパク質');
  });

  it('parseWeightKg accepts only finite 0 < w < 500', () => {
    expect(parseWeightKg(72)).toBe(72);
    expect(parseWeightKg(72.5)).toBe(72.5);
    for (const bad of [0, -1, 500, 1e9, NaN, Infinity, '72', null, undefined, {}]) {
      expect(parseWeightKg(bad)).toBeNull();
    }
  });
});
