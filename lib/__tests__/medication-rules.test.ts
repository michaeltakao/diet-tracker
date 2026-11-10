/** lib/medication-rules.ts — warnings shown on /add and /workout and sent to the AI (ADR-008 P0-7). */
import { describe, it, expect } from 'vitest';
import {
  MEDICATION_RULES, getConditionRules, getMedicationRules,
  getWorkoutWarnings, getNutritionWarnings, buildHealthContextPrompt,
} from '../medication-rules';

const names = (meds: string[]) => getMedicationRules(meds).map((r) => r.displayName);

describe('getMedicationRules', () => {
  it('matches by keyword, case-insensitively, either direction', () => {
    expect(names(['ワーファリン錠1mg'])).toEqual(['ワーファリン（抗凝固薬）']);
    expect(names(['WARFARIN'])).toEqual(['ワーファリン（抗凝固薬）']);
    expect(names(['ワーファ'])).toEqual(['ワーファリン（抗凝固薬）']); // partial input
  });
  it('no medications / unknown medication → no rules', () => {
    expect(getMedicationRules([])).toEqual([]);
    expect(getMedicationRules(['ビタミンC'])).toEqual([]);
  });
  it('a blank entry does not match every rule', () => {
    expect(getMedicationRules([''])).toEqual([]);
    expect(getMedicationRules(['  '])).toEqual([]);
    expect(names(['', 'ロキソニン'])).toHaveLength(1);
  });
  it('several medications → each matching rule once', () => {
    const r = getMedicationRules(['ロキソニン', 'アスピリン', 'メトホルミン']);
    expect(r).toHaveLength(2);
    expect(new Set(r).size).toBe(2);
  });
  it('every rule has at least one keyword', () => {
    for (const rule of MEDICATION_RULES) expect(rule.keywords.length).toBeGreaterThan(0);
  });
});

describe('warnings', () => {
  it('condition rules by exact name', () => {
    expect(getConditionRules(['糖尿病']).map((r) => r.condition)).toEqual(['糖尿病']);
    expect(getConditionRules(['糖尿'])).toEqual([]);
  });
  it('workout + nutrition warnings combine condition and medication, deduplicated', () => {
    const w = getWorkoutWarnings(['糖尿病'], ['インスリン']);
    expect(w.length).toBeGreaterThan(0);
    expect(new Set(w).size).toBe(w.length);
    const n = getNutritionWarnings([], ['ワーファリン']);
    expect(n.some((s) => s.includes('納豆'))).toBe(true);
  });
  it('nothing declared → no warnings', () => {
    expect(getWorkoutWarnings([], [])).toEqual([]);
    expect(getNutritionWarnings([], [])).toEqual([]);
  });
});

describe('buildHealthContextPrompt', () => {
  it('empty → empty string', () => {
    expect(buildHealthContextPrompt([], [])).toBe('');
  });
  it('lists conditions, medications and food interactions without the ⚠️ prefix', () => {
    const p = buildHealthContextPrompt(['高血圧'], ['ワーファリン']);
    expect(p).toContain('■ 持病: 高血圧');
    expect(p).toContain('■ 服薬中: ワーファリン');
    expect(p).toContain('[ワーファリン（抗凝固薬）] 食事注意:');
    expect(p).not.toContain('⚠️');
  });
});
