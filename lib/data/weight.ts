/**
 * Weight data access layer.
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async, fire-and-forget).
 *
 * STEP 6: dual-write added.
 * STEP 7: reads will prefer Supabase after migration runs.
 */

import {
  addWeightEntry    as _add,
  removeWeightEntry as _remove,
  getWeightEntries  as _getRecent,
  getLatestWeight   as _getLatest,
  getAppData        as _getAll,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { WeightEntry } from '@/lib/types';

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

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

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/** Add or replace the entry for the given date. */
export async function addWeightEntry(entry: WeightEntry): Promise<void> {
  // Step 1: localStorage
  _add(entry);

  // Step 2: Supabase (UPSERT — one row per user per date)
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('weight_logs').upsert({
    id:          entry.id,
    user_id:     ctx.userId,
    logged_date: entry.date,
    weight_kg:   entry.weight,
    logged_at:   entry.addedAt,
  }, { onConflict: 'user_id,logged_date' });

  if (error) {
    console.warn('[data/weight] Supabase addWeightEntry failed:', error.message);
  }
}

export async function removeWeightEntry(id: string): Promise<void> {
  // Step 1: localStorage
  _remove(id);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase
    .from('weight_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId);

  if (error) {
    console.warn('[data/weight] Supabase removeWeightEntry failed:', error.message);
  }
}
