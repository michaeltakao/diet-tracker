/**
 * /api/nutritionist safety (2026-11-17): request parsing of the optional
 * health context, and the deterministic free-text post-filter.
 */
import { describe, expect, it } from 'vitest';
import { screenSuggestions } from '@/lib/recommend-safety';
import { parseBody, MAX_HEALTH_ITEMS, MAX_HEALTH_ITEM_LEN } from '@/lib/nutritionist-request';
import type { UserHealthProfile } from '@/lib/types';

const profile = (conds: string[], meds: string[]): UserHealthProfile => ({
  age: null,
  healthConditions: conds,
  dietaryRestrictions: [],
  medications: meds,
  fitnessGoal: 'maintenance',
  activityLevel: 'moderately_active',
});

const SAFE = { title: '味噌汁を減塩に', detail: '朝の味噌汁を減塩タイプに替えましょう。' };
const NATTO = { title: '納豆を追加', detail: '朝食に納豆を1パック足しましょう。' };

describe('screenSuggestions', () => {
  it('replaces a warfarin-contraindicated suggestion, keeping length 3', () => {
    const { suggestions, blockedRefs } = screenSuggestions([SAFE, NATTO, SAFE], profile([], ['ワーファリン']));
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toBe(SAFE);
    expect(suggestions[2]).toBe(SAFE);
    expect(suggestions[1].title).toBe('提案を除外しました');
    expect(suggestions[1].detail).toContain('ワーファリン');
    expect(suggestions[1].detail).not.toContain('納豆');
    expect(blockedRefs).toEqual(['ワーファリン']);
  });

  it('also blocks a negated mention (known conservative false block)', () => {
    const neg = { title: '納豆は控えましょう', detail: '服薬中のため控えめに。' };
    expect(screenSuggestions([neg], profile([], ['ワーファリン'])).blockedRefs).toHaveLength(1);
  });

  it('keeps everything when the profile has no conditions or medications', () => {
    const input = [NATTO, SAFE, NATTO];
    const { suggestions, blockedRefs } = screenSuggestions(input, profile([], []));
    expect(suggestions).toEqual(input);
    expect(blockedRefs).toEqual([]);
  });
});

const BASE = {
  entries: [{ name: 'ご飯', calories: 250, protein: 4, fat: 0.5, carbs: 55 }],
  goals: { calories: 2000, protein: 57, fat: 60, carbs: 250 },
};

describe('nutritionist parseBody — health context', () => {
  it('defaults the health fields when absent (backwards compatible)', () => {
    const out = parseBody(BASE);
    expect(out).not.toBeNull();
    expect(out?.healthConditions).toEqual([]);
    expect(out?.medications).toEqual([]);
    expect(out?.weightKg).toBeNull();
  });

  it('accepts conditions, medications and weight', () => {
    const out = parseBody({ ...BASE, healthConditions: ['腎臓病'], medications: [' ワーファリン '], weightKg: 72 });
    expect(out?.healthConditions).toEqual(['腎臓病']);
    expect(out?.medications).toEqual(['ワーファリン']);
    expect(out?.weightKg).toBe(72);
  });

  it('drops an invalid weight instead of rejecting', () => {
    expect(parseBody({ ...BASE, weightKg: -5 })?.weightKg).toBeNull();
    expect(parseBody({ ...BASE, weightKg: '72' })?.weightKg).toBeNull();
  });

  it('truncates long strings and drops empty ones', () => {
    const out = parseBody({ ...BASE, medications: ['x'.repeat(200), '  '] });
    expect(out?.medications).toEqual(['x'.repeat(MAX_HEALTH_ITEM_LEN)]);
  });

  it('rejects malformed health fields', () => {
    expect(parseBody({ ...BASE, healthConditions: '腎臓病' })).toBeNull();
    expect(parseBody({ ...BASE, medications: [42] })).toBeNull();
    expect(parseBody({ ...BASE, medications: Array(MAX_HEALTH_ITEMS + 1).fill('a') })).toBeNull();
  });
});
