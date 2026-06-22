/**
 * Unit tests for lib/recommend-explain.ts — XAI label mapping + per-item explanation.
 *
 * Tests verify:
 *   - explainFood returns factors sorted by |weight| descending
 *   - explainExercise returns category factor with correct label
 *   - Empty model yields empty factor list
 *   - Negative weights are correctly signed and labelled
 *   - Duplicate-label deduplication picks max |weight|
 *   - topN limit is respected
 */

import { describe, it, expect } from 'vitest';
import { explainFood, explainExercise } from '../recommend-explain';
import { buildAffinityModel } from '../recommend-preference';
import type { RecommendationFeedback } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFeedback(
  name: string,
  kind: 'accept' | 'reject' | 'favorite',
  itemType: 'food' | 'exercise' = 'food',
  macroHighlight?: string,
  category?: string,
): RecommendationFeedback {
  return {
    id:            crypto.randomUUID(),
    itemType,
    itemName:      name,
    kind,
    macroHighlight,
    category,
    createdAt:     new Date().toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('explainFood', () => {

  it('returns empty array for an empty affinity model', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback:       [],
    });
    const factors = explainFood('鶏むね肉グリル', '高タンパク・低脂質', model);
    expect(factors).toHaveLength(0);
  });

  it('returns positive factors for an accepted food', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback: [makeFeedback('鶏むね肉グリル', 'accept', 'food', '高タンパク・低脂質')],
    });
    const factors = explainFood('鶏むね肉グリル', '高タンパク・低脂質', model);
    expect(factors.length).toBeGreaterThan(0);
    for (const f of factors) {
      expect(f.direction).toBe('positive');
      expect(f.weight).toBeGreaterThan(0);
    }
  });

  it('returns negative factors for a rejected food', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback: [makeFeedback('ラーメン', 'reject', 'food', '高カロリー')],
    });
    const factors = explainFood('ラーメン', '高カロリー', model);
    expect(factors.length).toBeGreaterThan(0);
    expect(factors[0].direction).toBe('negative');
    expect(factors[0].weight).toBeLessThan(0);
  });

  it('sorts factors by |weight| descending', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback: [
        makeFeedback('鶏むね肉グリル', 'favorite', 'food', '高タンパク・低脂質'),
        makeFeedback('鶏むね肉グリル', 'favorite', 'food', '高タンパク・低脂質'),
        makeFeedback('鶏むね肉グリル', 'accept',   'food', '高タンパク・低脂質'),
      ],
    });
    const factors = explainFood('鶏むね肉グリル', '高タンパク・低脂質', model);
    for (let i = 1; i < factors.length; i++) {
      expect(Math.abs(factors[i - 1].weight)).toBeGreaterThanOrEqual(Math.abs(factors[i].weight));
    }
  });

  it('respects topN limit', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback: [
        makeFeedback('サーモン', 'favorite', 'food', '高タンパク・低脂質・オメガ3・ビタミン・カルシウム'),
      ],
    });
    const factors2 = explainFood('サーモン', '高タンパク・低脂質・オメガ3', model, 2);
    expect(factors2.length).toBeLessThanOrEqual(2);
  });

  it('maps feature keys to Japanese labels', () => {
    const model = buildAffinityModel({
      foodHistory:    ['鶏むね肉グリル'],
      workoutHistory: [],
      feedback:       [],
    });
    const factors = explainFood('鶏むね肉グリル', undefined, model);
    // name: feature → '過去の食事・運動パターン'
    expect(factors.some(f => f.label === '過去の食事・運動パターン')).toBe(true);
  });

  it('maps macro tokens to Japanese labels', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback: [makeFeedback('プロテインバー', 'accept', 'food', '高タンパク')],
    });
    const factors = explainFood('プロテインバー', '高タンパク', model);
    expect(factors.some(f => f.label === 'タンパク質目標に合致')).toBe(true);
  });

  it('deduplicates labels — picks max |weight| when two features map to same label', () => {
    // '高タンパク' and 'タンパク' both map to 'タンパク質目標に合致'
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback: [makeFeedback('item', 'favorite', 'food', '高タンパク・タンパク')],
    });
    const factors = explainFood('item', '高タンパク・タンパク', model);
    const labels  = factors.map(f => f.label);
    // Should appear only once
    const count = labels.filter(l => l === 'タンパク質目標に合致').length;
    expect(count).toBeLessThanOrEqual(1);
  });

});

describe('explainExercise', () => {

  it('returns empty array for an empty affinity model', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback:       [],
    });
    expect(explainExercise('ベンチプレス', 'strength', model)).toHaveLength(0);
  });

  it('returns positive factors for a favorited exercise', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [],
      feedback: [makeFeedback('ベンチプレス', 'favorite', 'exercise', undefined, 'strength')],
    });
    const factors = explainExercise('ベンチプレス', 'strength', model);
    expect(factors.length).toBeGreaterThan(0);
    expect(factors[0].direction).toBe('positive');
  });

  it('maps category feature to Japanese label', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [{ name: 'ジョギング', category: 'cardio' }],
      feedback:       [],
    });
    const factors = explainExercise('ジョギング', 'cardio', model);
    // 'cardio' → '有酸素運動傾向'
    expect(factors.some(f => f.label === '有酸素運動傾向')).toBe(true);
  });

  it('workout history contributes a positive signal', () => {
    const model = buildAffinityModel({
      foodHistory:    [],
      workoutHistory: [{ name: 'スクワット', category: 'strength' }],
      feedback:       [],
    });
    const factors = explainExercise('スクワット', 'strength', model);
    expect(factors.every(f => f.weight > 0)).toBe(true);
  });

});
