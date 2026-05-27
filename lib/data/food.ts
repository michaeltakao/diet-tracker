/**
 * Food data access layer.
 *
 * Currently delegates to lib/storage.ts (localStorage).
 * STEP 6: replace internals with Supabase queries when user is authenticated.
 *
 * All page components should import from here — never directly from storage.ts.
 */

import {
  addFoodEntry as _add,
  removeFoodEntry as _remove,
  getEntriesForDate as _getByDate,
  getRecentFoods as _getRecent,
  getAppData as _getAll,
} from '@/lib/storage';
import type { FoodEntry } from '@/lib/types';

// ── Read ──────────────────────────────────────────────────────

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

// ── Write ─────────────────────────────────────────────────────

export function addFoodEntry(entry: FoodEntry): void {
  _add(entry);
}

export function removeFoodEntry(id: string): void {
  _remove(id);
}
