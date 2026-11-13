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
import { write as outboxWrite, type RowFor } from './outbox';
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

/** Supabase row for a food entry (user_id and build stamp added by the outbox). */
export function foodRow(entry: FoodEntry): RowFor<'food_logs'> {
  return {
    id:           entry.id,
    logged_date:  entry.date,
    meal_type:    entry.mealType as MealTypeEnum,
    name:         entry.name,
    calories:     entry.calories,
    protein_g:    entry.protein,
    fat_g:        entry.fat,
    carbs_g:      entry.carbs,
    photo_url:    entry.photo_url ?? null,
    logged_at:    entry.addedAt,
    servings:     entry.servings ?? null,
    serving_unit: entry.servingUnit ?? null,
    amount_g:     entry.amountG ?? null,
    source:       entry.source ?? null,
    source_id:    entry.sourceId ?? null,
    sodium_mg:    entry.sodiumMg ?? null,
    fiber_g:      entry.fiberG ?? null,
  };
}

/**
 * Add a food entry.
 *
 * 1. Writes synchronously to localStorage — UI updates immediately.
 * 2. Queues the Supabase upsert in the outbox (lib/data/outbox.ts), which
 *    sends it now and keeps it for retry if that fails (ADR-008 P0-6).
 */
export async function addFoodEntry(entry: FoodEntry): Promise<void> {
  _add(entry);
  await outboxWrite({ kind: 'upsert', table: 'food_logs', row: foodRow(entry), onConflict: 'id' });
}

/** Update an existing food entry (edit): localStorage, then the outbox. */
export async function updateFoodEntry(entry: FoodEntry): Promise<void> {
  _update(entry);
  await outboxWrite({ kind: 'upsert', table: 'food_logs', row: foodRow(entry), onConflict: 'id' });
}

/**
 * Remove a food entry by ID: localStorage, then a queued delete (which also
 * cancels a still-queued upsert of the same row).
 */
export async function removeFoodEntry(id: string): Promise<void> {
  _remove(id);
  await outboxWrite({ kind: 'delete', table: 'food_logs', id });
}
