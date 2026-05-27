/**
 * Weight data access layer.
 *
 * Currently delegates to lib/storage.ts (localStorage).
 * STEP 6: replace internals with Supabase queries when user is authenticated.
 */

import {
  addWeightEntry as _add,
  removeWeightEntry as _remove,
  getWeightEntries as _getRecent,
  getLatestWeight as _getLatest,
  getAppData as _getAll,
} from '@/lib/storage';
import type { WeightEntry } from '@/lib/types';

// ── Read ──────────────────────────────────────────────────────

/** Most recent `days` weight entries, sorted ascending by date. */
export function getWeightEntries(days = 30): WeightEntry[] {
  return _getRecent(days);
}

/** The single most recent weight entry. */
export function getLatestWeightEntry(): WeightEntry | undefined {
  return _getLatest();
}

/** All weight entries. */
export function getAllWeightEntries(): WeightEntry[] {
  return _getAll().weightEntries;
}

/** Weight entries for a date range [startDate, endDate] inclusive. */
export function getWeightEntriesForRange(startDate: string, endDate: string): WeightEntry[] {
  return _getAll().weightEntries.filter(
    (e) => e.date >= startDate && e.date <= endDate,
  );
}

// ── Write ─────────────────────────────────────────────────────

/** Add or replace the entry for the given date. */
export function addWeightEntry(entry: WeightEntry): void {
  _add(entry);
}

export function removeWeightEntry(id: string): void {
  _remove(id);
}
