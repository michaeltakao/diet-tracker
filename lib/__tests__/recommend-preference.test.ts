import { describe, it, expect } from 'vitest';
import {
  buildAffinityModel,
  exerciseFeatures,
  explainAffinity,
  foodFeatures,
  rankRecommendation,
  scoreExercise,
  scoreFood,
  type PreferenceSignals,
} from '@/lib/recommend-preference';
import type {
  Recommendation,
  RecommendationFeedback,
  RecommendedExercise,
  RecommendedFood,
} from '@/lib/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function food(name: string, macroHighlight = '', calories = 100): RecommendedFood {
  return { name, reason: 'r', calories, macroHighlight };
}

function exercise(name: string, category = 'strength'): RecommendedExercise {
  return { name, category, duration: '30分', reason: 'r' };
}

function feedback(
  itemType: 'food' | 'exercise',
  itemName: string,
  kind: RecommendationFeedback['kind'],
  extra: Partial<RecommendationFeedback> = {},
): RecommendationFeedback {
  return { id: `${itemType}:${itemName}:${kind}`, itemType, itemName, kind, createdAt: '2026-06-10T00:00:00Z', ...extra };
}

function signals(overrides: Partial<PreferenceSignals> = {}): PreferenceSignals {
  return { foodHistory: [], workoutHistory: [], feedback: [], ...overrides };
}

function rec(
  foods: RecommendedFood[],
  exercises: RecommendedExercise[] = [],
): Recommendation {
  return { foods, exercises, warnings: [], adjustedMacros: null, generatedAt: '2026-06-10T00:00:00Z' };
}

// ── Feature extraction ──────────────────────────────────────────────────────────

describe('feature extraction', () => {
  it('food features include name and split macro highlight tokens', () => {
    expect(foodFeatures('鶏胸肉', '高タンパク・低脂質')).toEqual([
      'name:鶏胸肉',
      'macro:高タンパク',
      'macro:低脂質',
    ]);
  });

  it('food features tolerate missing / empty macro highlight', () => {
    expect(foodFeatures('納豆')).toEqual(['name:納豆']);
    expect(foodFeatures('納豆', '')).toEqual(['name:納豆']);
  });

  it('exercise features include name and category', () => {
    expect(exerciseFeatures('スクワット', 'strength')).toEqual([
      'name:スクワット',
      'cat:strength',
    ]);
  });
});

// ── Model construction ───────────────────────────────────────────────────────────

describe('buildAffinityModel', () => {
  it('history adds positive weight to consumed food features', () => {
    const model = buildAffinityModel(signals({ foodHistory: ['鶏胸肉', '鶏胸肉'] }));
    expect(model.weights.get('name:鶏胸肉')).toBe(2); // two consumptions × W_HISTORY
  });

  it('favorite outweighs accept; reject is negative', () => {
    const fav = buildAffinityModel(signals({ feedback: [feedback('food', 'A', 'favorite')] }));
    const acc = buildAffinityModel(signals({ feedback: [feedback('food', 'A', 'accept')] }));
    const rej = buildAffinityModel(signals({ feedback: [feedback('food', 'A', 'reject')] }));
    expect(fav.weights.get('name:a')!).toBeGreaterThan(acc.weights.get('name:a')!);
    expect(acc.weights.get('name:a')!).toBeGreaterThan(0);
    expect(rej.weights.get('name:a')!).toBeLessThan(0);
  });

  it('is order-independent across distinct signals (deterministic)', () => {
    const a = buildAffinityModel(signals({ foodHistory: ['X', 'Y'] }));
    const b = buildAffinityModel(signals({ foodHistory: ['Y', 'X'] }));
    expect([...a.weights.entries()].sort()).toEqual([...b.weights.entries()].sort());
  });

  it('feedback propagates to macro/category features', () => {
    const m = buildAffinityModel(
      signals({ feedback: [feedback('food', '豆腐', 'favorite', { macroHighlight: '高タンパク' })] }),
    );
    expect(m.weights.get('macro:高タンパク')).toBe(4);
  });
});

// ── Scoring ────────────────────────────────────────────────────────────────────

describe('scoring', () => {
  it('unseen item scores 0', () => {
    const model = buildAffinityModel(signals());
    expect(scoreFood(food('未知の食品'), model)).toBe(0);
    expect(scoreExercise(exercise('未知の運動'), model)).toBe(0);
  });

  it('score is length-normalised (mean over features)', () => {
    // name:A = 2 (accept), macro:高 = 2 (accept) ⇒ mean = 2
    const model = buildAffinityModel(
      signals({ feedback: [feedback('food', 'A', 'accept', { macroHighlight: '高' })] }),
    );
    expect(scoreFood(food('A', '高'), model)).toBeCloseTo(2);
  });
});

// ── Re-ranking (the Phase-B deliverable) ───────────────────────────────────────

describe('rankRecommendation', () => {
  it('orders preferred foods first, disliked last', () => {
    const model = buildAffinityModel(
      signals({
        feedback: [feedback('food', 'liked', 'favorite'), feedback('food', 'disliked', 'reject')],
      }),
    );
    const ranked = rankRecommendation(
      rec([food('neutral'), food('disliked'), food('liked')]),
      model,
    );
    expect(ranked.foods.map((f) => f.name)).toEqual(['liked', 'neutral', 'disliked']);
  });

  it('preserves the exact set of items (only permutes order)', () => {
    const model = buildAffinityModel(signals({ feedback: [feedback('food', 'b', 'favorite')] }));
    const input = rec([food('a'), food('b'), food('c')]);
    const ranked = rankRecommendation(input, model);
    expect(new Set(ranked.foods.map((f) => f.name))).toEqual(new Set(['a', 'b', 'c']));
    expect(ranked.foods).toHaveLength(3);
  });

  it('is a stable sort: equal-score items keep original (LLM) order', () => {
    const model = buildAffinityModel(signals()); // all scores 0
    const input = rec([food('first'), food('second'), food('third')]);
    expect(rankRecommendation(input, model).foods.map((f) => f.name)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('does not mutate the input recommendation', () => {
    const model = buildAffinityModel(signals({ feedback: [feedback('food', 'z', 'favorite')] }));
    const input = rec([food('a'), food('z')]);
    const snapshot = input.foods.map((f) => f.name);
    rankRecommendation(input, model);
    expect(input.foods.map((f) => f.name)).toEqual(snapshot);
  });

  it('ranks exercises by category affinity', () => {
    const model = buildAffinityModel(
      signals({ workoutHistory: [{ name: 'ランニング', category: 'cardio' }] }),
    );
    const ranked = rankRecommendation(
      rec([], [exercise('スクワット', 'strength'), exercise('ジョギング', 'cardio')]),
      model,
    );
    expect(ranked.exercises[0].category).toBe('cardio');
  });

  it('preserves non-list recommendation fields', () => {
    const model = buildAffinityModel(signals());
    const input: Recommendation = {
      ...rec([food('a')]),
      warnings: ['注意'],
      macroCapsApplied: ['cap'],
    };
    const ranked = rankRecommendation(input, model);
    expect(ranked.warnings).toEqual(['注意']);
    expect(ranked.macroCapsApplied).toEqual(['cap']);
    expect(ranked.generatedAt).toBe(input.generatedAt);
  });
});

// ── Explainability ──────────────────────────────────────────────────────────────

describe('explainAffinity', () => {
  it('returns top features by absolute weight, deterministically', () => {
    const model = buildAffinityModel(
      signals({
        foodHistory: ['納豆'],
        feedback: [feedback('food', '揚げ物', 'reject'), feedback('food', '豆腐', 'favorite')],
      }),
    );
    const top = explainAffinity(model, 2);
    expect(top).toHaveLength(2);
    expect(Math.abs(top[0].weight)).toBeGreaterThanOrEqual(Math.abs(top[1].weight));
    // favorite (+4) and reject (-3) outrank single history (+1)
    expect(top.map((t) => t.feature)).toEqual(
      expect.arrayContaining(['name:豆腐', 'name:揚げ物']),
    );
  });

  it('omits zero-weight features', () => {
    // accept(+2) then reject(-2) on the same item cancels to 0 ⇒ excluded
    const model = buildAffinityModel(
      signals({ feedback: [feedback('food', 'A', 'accept'), feedback('food', 'A', 'reject')] }),
    );
    // accept=+2, reject=-3 ⇒ net -1, not zero; force a true zero instead:
    model.weights.set('name:zero', 0);
    expect(explainAffinity(model).some((e) => e.feature === 'name:zero')).toBe(false);
  });
});
