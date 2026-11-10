/**
 * Weight data access layer.
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase via the outbox when authenticated
 *        (queued in IndexedDB and retried on failure — ADR-008 P0-6).
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
import { write as outboxWrite } from './outbox';
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

  // Step 2: outbox → Supabase (UPSERT — one row per user per date; replay is
  // last-write-wins on (user_id, logged_date), see lib/data/outbox.ts)
  await outboxWrite({
    kind: 'upsert',
    table: 'weight_logs',
    row: { id: entry.id, logged_date: entry.date, weight_kg: entry.weight, logged_at: entry.addedAt },
    onConflict: 'user_id,logged_date',
  });
}

export async function removeWeightEntry(id: string): Promise<void> {
  // The date lets the queued delete replace a still-queued upsert of that day.
  const loggedDate = _getAll().weightEntries.find((e) => e.id === id)?.date;
  // Step 1: localStorage
  _remove(id);

  // Step 2: outbox → Supabase
  await outboxWrite({ kind: 'delete', table: 'weight_logs', id, ...(loggedDate ? { loggedDate } : {}) });
}
