/**
 * Favorite foods data access layer (♡).
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async,
 *        fire-and-forget) — same pattern as lib/data/food.ts.
 *
 * Phase B wiring: favoriting also records a `kind: 'favorite'` event via
 * addRecommendationFeedback, whose macroHighlight is derived here in the SAME
 * vocabulary foodFeatures() tokenises (`・`-joined tokens), so the signal flows
 * into buildAffinityModel's W_FAVORITE path with no recommender changes.
 * Unfavoriting removes the pill but keeps the feedback history (preference-
 * change history is research data; see migration 008).
 */

import {
  getFavoriteFoods as _get,
  addFavoriteFood as _add,
  removeFavoriteFood as _remove,
  addRecommendationFeedback,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { FavoriteFood } from '@/lib/types';

// ── Macro-highlight derivation (feature-vocabulary bridge) ────────────────────

/** Thresholds are per meal/portion, aligned with common 食品表示 conventions. */
const HIGH_PROTEIN_G = 20;
const LOW_FAT_G = 10;
const LOW_CARB_G = 20;
const LOW_KCAL = 300;

/**
 * Derive a macroHighlight string ('高タンパク・低脂質' …) from raw macros.
 *
 * Tokens are joined with '・' — exactly what foodFeatures() splits on — and
 * drawn from the same vocabulary the LLM recommender uses, so favorited foods
 * and recommended foods share `macro:*` features in the affinity model.
 */
export function deriveMacroHighlight(food: {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}): string {
  const tokens: string[] = [];
  if (food.protein >= HIGH_PROTEIN_G) tokens.push('高タンパク');
  if (food.fat <= LOW_FAT_G) tokens.push('低脂質');
  if (food.carbs <= LOW_CARB_G) tokens.push('低糖質');
  if (food.calories <= LOW_KCAL) tokens.push('低カロリー');
  return tokens.length > 0 ? tokens.join('・') : 'バランス';
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getFavoriteFoods(): FavoriteFood[] {
  return _get();
}

export function isFavoriteFood(name: string): boolean {
  return _get().some(f => f.name === name);
}

// ── Write (dual-write) ────────────────────────────────────────────────────────

export interface FavoriteInput {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sourceId?: string;
}

/**
 * Toggle ♡ on a food. Returns the new state (true = now favorited).
 *
 * Favoriting writes the favorite AND a Phase B 'favorite' feedback event.
 * Unfavoriting removes only the favorite (feedback history is preserved).
 */
export async function toggleFavorite(food: FavoriteInput): Promise<boolean> {
  if (isFavoriteFood(food.name)) {
    _remove(food.name);
    const ctx = await getWriteContext();
    if (ctx) {
      const { error } = await ctx.supabase
        .from('favorite_foods')
        .delete()
        .eq('user_id', ctx.userId)
        .eq('name', food.name);
      if (error) console.warn('[data/favorites] Supabase delete failed:', error.message);
    }
    return false;
  }

  const macroHighlight = deriveMacroHighlight(food);
  const fav: FavoriteFood = {
    id: crypto.randomUUID(),
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    fat: food.fat,
    carbs: food.carbs,
    macroHighlight,
    sourceId: food.sourceId,
    createdAt: new Date().toISOString(),
  };
  _add(fav);

  // Phase B: ♡ is the strongest explicit preference signal (W_FAVORITE).
  addRecommendationFeedback({
    id: crypto.randomUUID(),
    itemType: 'food',
    itemName: food.name,
    kind: 'favorite',
    macroHighlight,
    createdAt: fav.createdAt,
  });

  const ctx = await getWriteContext();
  if (ctx) {
    const { error } = await ctx.supabase.from('favorite_foods').upsert({
      id: fav.id,
      user_id: ctx.userId,
      name: fav.name,
      calories: fav.calories,
      protein_g: fav.protein,
      fat_g: fav.fat,
      carbs_g: fav.carbs,
      macro_highlight: fav.macroHighlight,
      source_id: fav.sourceId ?? null,
      created_at: fav.createdAt,
    }, { onConflict: 'id' });
    if (error) console.warn('[data/favorites] Supabase upsert failed:', error.message);
  }
  return true;
}
