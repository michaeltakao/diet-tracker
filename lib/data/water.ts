/**
 * Water (hydration) data access layer.
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async, fire-and-forget).
 *
 * STEP 6: dual-write added.
 * STEP 7: reads will prefer Supabase after migration runs.
 */

import {
  getWaterForDate as _getByDate,
  addWater        as _add,
  setWater        as _set,
  getAppData      as _getAll,
} from '@/lib/storage';
import { getWriteContext } from './_write';

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

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

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/** Add `ml` to the existing total for the date. */
export async function addWater(date: string, ml: number): Promise<void> {
  // Step 1: localStorage (updates the running total)
  _add(date, ml);

  // Step 2: Supabase — UPSERT with the new running total
  const ctx = await getWriteContext();
  if (!ctx) return;

  const newTotal = _getByDate(date); // read back the updated total

  const { error } = await ctx.supabase.from('water_logs').upsert({
    user_id:     ctx.userId,
    logged_date: date,
    total_ml:    newTotal,
  }, { onConflict: 'user_id,logged_date' });

  if (error) {
    console.warn('[data/water] Supabase addWater failed:', error.message);
  }
}

/** Set the total for the date to exactly `ml`. */
export async function setWater(date: string, ml: number): Promise<void> {
  // Step 1: localStorage
  _set(date, ml);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('water_logs').upsert({
    user_id:     ctx.userId,
    logged_date: date,
    total_ml:    ml,
  }, { onConflict: 'user_id,logged_date' });

  if (error) {
    console.warn('[data/water] Supabase setWater failed:', error.message);
  }
}
