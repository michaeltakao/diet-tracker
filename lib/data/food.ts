/**
 * Food data access layer.
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async, fire-and-forget).
 *
 * STEP 6: dual-write added.
 * STEP 7: reads will prefer Supabase after migration runs.
 *
 * See: docs/decisions/ADR-006-data-abstraction.md
 *      docs/decisions/ADR-007-dual-write.md
 */

import {
  addFoodEntry      as _add,
  removeFoodEntry   as _remove,
  updateFoodEntry   as _update,
  getEntriesForDate as _getByDate,
  getRecentFoods    as _getRecent,
  getAppData        as _getAll,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { FoodEntry } from '@/lib/types';
import type { MealTypeEnum } from '@/lib/database.types';

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

/** All food entries for a specific date (YYYY-MM-DD). */
export function getFoodEntriesForDate(date: string): FoodEntry[] {
  return _getByDate(date);
}

/** Most recently added unique food names, up to `limit`. */
export function getRecentFoods(limit = 5): FoodEntry[] {
  return _getRecent(limit);
}

/** All food entries across all dates. */
export function getAllFoodEntries(): FoodEntry[] {
  return _getAll().foodEntries;
}

/** Food entries for a date range [startDate, endDate] inclusive (YYYY-MM-DD). */
export function getFoodEntriesForRange(startDate: string, endDate: string): FoodEntry[] {
  return _getAll().foodEntries.filter(
    (e) => e.date >= startDate && e.date <= endDate,
  );
}

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/**
 * Add a food entry.
 *
 * 1. Writes synchronously to localStorage — UI updates immediately.
 * 2. Fires async write to Supabase if user is authenticated.
 *    Supabase failure is logged but never propagated to UI.
 */
export async function addFoodEntry(entry: FoodEntry): Promise<void> {
  // Step 1: localStorage (synchronous)
  _add(entry);

  // Step 2: Supabase (async, background)
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('food_logs').upsert({
    id:          entry.id,
    user_id:     ctx.userId,
    logged_date: entry.date,
    meal_type:   entry.mealType as MealTypeEnum,
    name:        entry.name,
    calories:    entry.calories,
    protein_g:   entry.protein,
    fat_g:       entry.fat,
    carbs_g:     entry.carbs,
    photo_url:   entry.photo_url ?? null,
    logged_at:   entry.addedAt,
    servings:     entry.servings ?? null,
    serving_unit: entry.servingUnit ?? null,
    amount_g:     entry.amountG ?? null,
    source:       entry.source ?? null,
    source_id:    entry.sourceId ?? null,
    sodium_mg:    entry.sodiumMg ?? null,
    fiber_g:      entry.fiberG ?? null,
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[data/food] Supabase addFoodEntry failed:', error.message);
  }
}

/**
 * Update an existing food entry (edit).
 * Writes to localStorage immediately, then syncs to Supabase.
 */
export async function updateFoodEntry(entry: FoodEntry): Promise<void> {
  _update(entry);

  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('food_logs').upsert({
    id:          entry.id,
    user_id:     ctx.userId,
    logged_date: entry.date,
    meal_type:   entry.mealType as MealTypeEnum,
    name:        entry.name,
    calories:    entry.calories,
    protein_g:   entry.protein,
    fat_g:       entry.fat,
    carbs_g:     entry.carbs,
    photo_url:   entry.photo_url ?? null,
    logged_at:   entry.addedAt,
    servings:     entry.servings ?? null,
    serving_unit: entry.servingUnit ?? null,
    amount_g:     entry.amountG ?? null,
    source:       entry.source ?? null,
    source_id:    entry.sourceId ?? null,
    sodium_mg:    entry.sodiumMg ?? null,
    fiber_g:      entry.fiberG ?? null,
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[data/food] Supabase updateFoodEntry failed:', error.message);
  }
}

/**
 * Remove a food entry by ID.
 *
 * 1. Removes from localStorage immediately.
 * 2. Deletes from Supabase if authenticated.
 */
export async function removeFoodEntry(id: string): Promise<void> {
  // Step 1: localStorage
  _remove(id);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase
    .from('food_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId);

  if (error) {
    console.warn('[data/food] Supabase removeFoodEntry failed:', error.message);
  }
}
