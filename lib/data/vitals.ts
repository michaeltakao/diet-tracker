/**
 * Vitals data access layer (BP / glucose — record only, never interpreted).
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async,
 *        fire-and-forget dual-write, weight.ts pattern).
 */

import {
  addVitalEntry         as _add,
  removeVitalEntry      as _remove,
  getAllVitalEntries    as _getAll,
  getVitalEntriesForDate as _getForDate,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { VitalEntry } from '@/lib/types';

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

/** All vital entries, in insertion order. */
export function getAllVitalEntries(): VitalEntry[] {
  return _getAll();
}

/** Vital entries for one JST day. */
export function getVitalEntriesForDate(date: string): VitalEntry[] {
  return _getForDate(date);
}

/** Vital entries for a date range [startDate, endDate] inclusive. */
export function getVitalEntriesForRange(startDate: string, endDate: string): VitalEntry[] {
  return _getAll().filter((e) => e.date >= startDate && e.date <= endDate);
}

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/** Add a vital measurement (per-measurement rows — no daily uniqueness). */
export async function addVitalEntry(entry: VitalEntry): Promise<void> {
  // Step 1: localStorage
  _add(entry);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('vital_logs').upsert({
    id:              entry.id,
    user_id:         ctx.userId,
    logged_date:     entry.date,
    kind:            entry.kind,
    systolic:        entry.kind === 'blood_pressure' ? entry.systolic : null,
    diastolic:       entry.kind === 'blood_pressure' ? entry.diastolic : null,
    glucose_mg_dl:   entry.kind === 'blood_glucose' ? entry.glucoseMgDl : null,
    glucose_context: entry.kind === 'blood_glucose' ? entry.glucoseContext : null,
    notes:           entry.notes ?? null,
    created_at:      entry.addedAt,
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[data/vitals] Supabase addVitalEntry failed:', error.message);
  }
}

export async function removeVitalEntry(id: string): Promise<void> {
  // Step 1: localStorage
  _remove(id);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase
    .from('vital_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId);

  if (error) {
    console.warn('[data/vitals] Supabase removeVitalEntry failed:', error.message);
  }
}
