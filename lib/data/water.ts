/**
 * Water (hydration) data access layer.
 *
 * Currently delegates to lib/storage.ts (localStorage).
 * STEP 6: replace internals with Supabase queries when user is authenticated.
 */

import {
  getWaterForDate as _getByDate,
  addWater as _add,
  setWater as _set,
  getAppData as _getAll,
} from '@/lib/storage';

// ── Read ──────────────────────────────────────────────────────

/** Total ml consumed on a specific date (YYYY-MM-DD). Returns 0 if no record. */
export function getWaterForDate(date: string): number {
  return _getByDate(date);
}

/** Full waterByDate map (date string → ml). */
export function getAllWaterByDate(): Record<string, number> {
  return _getAll().waterByDate;
}

/** Water totals for a date range [startDate, endDate] inclusive. */
export function getWaterForRange(startDate: string, endDate: string): Record<string, number> {
  const all = _getAll().waterByDate;
  return Object.fromEntries(
    Object.entries(all).filter(([date]) => date >= startDate && date <= endDate),
  );
}

// ── Write ─────────────────────────────────────────────────────

/** Add `ml` to the existing total for the date. */
export function addWater(date: string, ml: number): void {
  _add(date, ml);
}

/** Set the total for the date to exactly `ml`. */
export function setWater(date: string, ml: number): void {
  _set(date, ml);
}
