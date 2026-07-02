import { describe, it, expect } from 'vitest';
import {
  screenFood,
  clampMacros,
  buildSafetyReport,
  filterRecommendation,
} from '@/lib/recommend-safety';
import type {
  UserHealthProfile,
  DailyGoals,
  Recommendation,
  RecommendedFood,
} from '@/lib/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

function profile(overrides: Partial<UserHealthProfile> = {}): UserHealthProfile {
  return {
    age:                 40,
    healthConditions:    [],
    dietaryRestrictions: [],
    medications:         [],
    fitnessGoal:         'maintenance',
    activityLevel:       'moderately_active',
    ...overrides,
  };
}

const GOALS: DailyGoals = { calories: 2000, protein: 120, fat: 60, carbs: 250, water: 2000 };

function food(name: string, extra: Partial<RecommendedFood> = {}): RecommendedFood {
  return { name, reason: 'r', calories: 200, macroHighlight: '高タンパク', ...extra };
}

function rawRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    foods:          [],
    exercises:      [],
    warnings:       [],
    adjustedMacros: null,
    generatedAt:    '2026-06-03T00:00:00.000Z',
    ...overrides,
  };
}

// ── screenFood ──────────────────────────────────────────────────────────────

describe('screenFood', () => {
  it('blocks 納豆 for a warfarin user (contraindicated)', () => {
    const { allowed, notes } = screenFood('ひきわり納豆', profile({ medications: ['ワーファリン'] }));
    expect(allowed).toBe(false);
    expect(notes.some(n => n.severity === 'contraindicated' && n.ref === 'ワーファリン')).toBe(true);
  });

  it('allows 納豆 for a user not on warfarin', () => {
    const { allowed, notes } = screenFood('ひきわり納豆', profile());
    expect(allowed).toBe(true);
    expect(notes).toHaveLength(0);
  });

  it('blocks グレープフルーツ for a statin user', () => {
    expect(screenFood('グレープフルーツ', profile({ medications: ['リピトール'] })).allowed).toBe(false);
  });

  it('matches medications bidirectionally (substring of profile entry)', () => {
    // user typed a more specific name that contains the rule keyword
    expect(screenFood('グレープフルーツジュース', profile({ medications: ['アムロジピンOD錠'] })).allowed).toBe(false);
  });

  it('flags 牛乳 for a tetracycline user as caution, not a block', () => {
    const { allowed, notes } = screenFood('牛乳', profile({ medications: ['ミノサイクリン'] }));
    expect(allowed).toBe(true);
    expect(notes).toHaveLength(1);
    expect(notes[0].severity).toBe('caution');
  });

  it('returns no notes for an unrelated food', () => {
    const { allowed, notes } = screenFood('鶏むね肉のグリル', profile({ medications: ['ワーファリン'] }));
    expect(allowed).toBe(true);
    expect(notes).toHaveLength(0);
  });
});

// ── clampMacros ─────────────────────────────────────────────────────────────

describe('clampMacros', () => {
  it('clamps protein to 0.8 g/kg for a CKD user', () => {
    const adjusted: DailyGoals = { ...GOALS, protein: 120 };
    const { macros, capsApplied } = clampMacros(adjusted, profile({ healthConditions: ['腎臓病'] }), 60);
    expect(macros.protein).toBe(48); // 0.8 * 60
    expect(capsApplied).toHaveLength(1);
  });

  it('leaves protein untouched when already under the cap', () => {
    const adjusted: DailyGoals = { ...GOALS, protein: 40 };
    const { macros, capsApplied } = clampMacros(adjusted, profile({ healthConditions: ['腎臓病'] }), 60);
    expect(macros.protein).toBe(40);
    expect(capsApplied).toHaveLength(0);
  });

  it('does not clamp for a non-CKD user', () => {
    const adjusted: DailyGoals = { ...GOALS, protein: 200 };
    const { macros, capsApplied } = clampMacros(adjusted, profile(), 60);
    expect(macros.protein).toBe(200);
    expect(capsApplied).toHaveLength(0);
  });

  it('cannot clamp without a known weight', () => {
    const adjusted: DailyGoals = { ...GOALS, protein: 200 };
    const { macros, capsApplied } = clampMacros(adjusted, profile({ healthConditions: ['腎臓病'] }), null);
    expect(macros.protein).toBe(200);
    expect(capsApplied).toHaveLength(0);
  });
});

// ── buildSafetyReport ───────────────────────────────────────────────────────

describe('buildSafetyReport', () => {
  it('emits mandatory warnings, ban list and prompt text for a warfarin user', () => {
    const report = buildSafetyReport(profile({ medications: ['ワーファリン'] }), 60);
    expect(report.contraindicatedTerms).toEqual(expect.arrayContaining(['納豆', 'クロレラ', '青汁']));
    expect(report.promptInjection).toContain('禁忌');
    expect(report.mandatoryWarnings.length).toBeGreaterThan(0);
  });

  it('is empty for a user with no conditions or medications', () => {
    const report = buildSafetyReport(profile(), 60);
    expect(report.contraindicatedTerms).toHaveLength(0);
    expect(report.mandatoryWarnings).toHaveLength(0);
    expect(report.promptInjection).toBe('');
  });

  it('includes a renal protein cap line for a CKD user with known weight', () => {
    const report = buildSafetyReport(profile({ healthConditions: ['腎臓病'] }), 70);
    expect(report.promptInjection).toContain('56g'); // 0.8 * 70
  });
});

// ── filterRecommendation (the gate) ─────────────────────────────────────────

describe('filterRecommendation', () => {
  it('removes a contraindicated food and records why', () => {
    const raw = rawRec({ foods: [food('納豆ごはん'), food('焼き鮭')] });
    const out = filterRecommendation(raw, profile({ medications: ['ワーファリン'] }), 60);
    expect(out.foods.map(f => f.name)).toEqual(['焼き鮭']);
    expect(out.warnings.some(w => w.includes('納豆ごはん') && w.includes('除外'))).toBe(true);
  });

  it('keeps caution foods but annotates them with safetyNotes', () => {
    const raw = rawRec({ foods: [food('牛乳')] });
    const out = filterRecommendation(raw, profile({ medications: ['ミノサイクリン'] }), 60);
    expect(out.foods).toHaveLength(1);
    expect(out.foods[0].safetyNotes?.[0].severity).toBe('caution');
  });

  it('guarantees mandatory warnings even when the LLM returns none', () => {
    const raw = rawRec({ foods: [food('焼き鮭')], warnings: [] });
    const out = filterRecommendation(raw, profile({ medications: ['ワーファリン'] }), 60);
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it('clamps adjustedMacros and surfaces the cap for a CKD user', () => {
    const raw = rawRec({ adjustedMacros: { ...GOALS, protein: 150 } });
    const out = filterRecommendation(raw, profile({ healthConditions: ['腎臓病'] }), 50);
    expect(out.adjustedMacros?.protein).toBe(40); // 0.8 * 50
    expect(out.macroCapsApplied?.length).toBeGreaterThan(0);
  });

  it('leaves a healthy user’s recommendation essentially unchanged', () => {
    const raw = rawRec({ foods: [food('焼き鮭'), food('サラダ')], warnings: ['よく噛んで食べましょう'] });
    const out = filterRecommendation(raw, profile(), 60);
    expect(out.foods.map(f => f.name)).toEqual(['焼き鮭', 'サラダ']);
    expect(out.warnings).toEqual(['よく噛んで食べましょう']);
    expect(out.macroCapsApplied).toBeUndefined();
  });

  it('deduplicates warnings that the LLM repeats from the static rules', () => {
    const raw = rawRec({ foods: [], warnings: ['塩分は1日6g未満を目標に'] });
    const out = filterRecommendation(raw, profile({ healthConditions: ['高血圧'] }), 60);
    const occurrences = out.warnings.filter(w => w === '塩分は1日6g未満を目標に').length;
    expect(occurrences).toBe(1);
  });
});
