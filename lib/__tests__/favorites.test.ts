/**
 * Favorites → Phase B wiring tests.
 *
 * The critical property: deriveMacroHighlight's output must tokenize into the
 * SAME `macro:*` feature vocabulary that foodFeatures() produces for LLM
 * recommendations, so a ♡ favorite influences the affinity ranking of future
 * recommended foods that share macro traits.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deriveMacroHighlight, toggleFavorite, isFavoriteFood } from '../data/favorites';
import { buildAffinityModel, foodFeatures, scoreFood } from '../recommend-preference';
import { getRecommendationFeedback, getFavoriteFoods } from '../storage';

// storage.ts guards on `typeof window` and uses global localStorage — stub both.
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', makeLocalStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deriveMacroHighlight', () => {
  it('high-protein low-fat meal → 高タンパク・低脂質 (+低カロリー when ≤300)', () => {
    expect(deriveMacroHighlight({ calories: 250, protein: 30, fat: 5, carbs: 25 }))
      .toBe('高タンパク・低脂質・低カロリー');
  });

  it('nothing notable → バランス', () => {
    expect(deriveMacroHighlight({ calories: 700, protein: 15, fat: 25, carbs: 90 }))
      .toBe('バランス');
  });

  it('tokens survive a foodFeatures round-trip (vocabulary overlap)', () => {
    const highlight = deriveMacroHighlight({ calories: 250, protein: 30, fat: 5, carbs: 15 });
    const features = foodFeatures('鶏むね肉サラダ', highlight);
    // every ・-token must become one macro:* feature
    expect(features).toContain('macro:高タンパク');
    expect(features).toContain('macro:低脂質');
    expect(features).toContain('macro:低糖質');
    expect(features).toContain('macro:低カロリー');
  });
});

describe('toggleFavorite (Phase B wiring)', () => {
  const food = { name: '鶏むね肉サラダ', calories: 250, protein: 30, fat: 5, carbs: 15 };

  it('adds the favorite and returns true', async () => {
    const nowFav = await toggleFavorite(food);
    expect(nowFav).toBe(true);
    expect(isFavoriteFood(food.name)).toBe(true);
    expect(getFavoriteFoods()).toHaveLength(1);
    expect(getFavoriteFoods()[0].macroHighlight).toContain('高タンパク');
  });

  it("records a 'favorite' recommendation-feedback event with the derived highlight", async () => {
    await toggleFavorite(food);
    const fb = getRecommendationFeedback();
    expect(fb).toHaveLength(1);
    expect(fb[0]).toMatchObject({
      itemType: 'food',
      itemName: food.name,
      kind: 'favorite',
    });
    expect(fb[0].macroHighlight).toBe(deriveMacroHighlight(food));
  });

  it('the feedback flows into buildAffinityModel and boosts macro-similar foods', async () => {
    await toggleFavorite(food);
    const model = buildAffinityModel({
      foodHistory: [],
      workoutHistory: [],
      feedback: getRecommendationFeedback(),
    });
    // A DIFFERENT recommended food sharing macro traits scores > 0 via macro:* overlap
    const similar = {
      name: '豆腐ステーキ',
      reason: '',
      calories: 200,
      macroHighlight: '高タンパク・低カロリー',
    };
    const unrelated = {
      name: 'カツ丼',
      reason: '',
      calories: 900,
      macroHighlight: '高炭水化物',
    };
    expect(scoreFood(similar, model)).toBeGreaterThan(0);
    expect(scoreFood(similar, model)).toBeGreaterThan(scoreFood(unrelated, model));
  });

  it('toggling again removes the favorite but keeps feedback history', async () => {
    await toggleFavorite(food);
    const nowFav = await toggleFavorite(food);
    expect(nowFav).toBe(false);
    expect(getFavoriteFoods()).toHaveLength(0);
    expect(getRecommendationFeedback()).toHaveLength(1); // history preserved
  });
});
