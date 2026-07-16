/**
 * Symptom data access layer (record + display only — never diagnostic).
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async,
 *        fire-and-forget dual-write, weight.ts pattern).
 */

import {
  addSymptomEntry     as _add,
  removeSymptomEntry  as _remove,
  getAllSymptomEntries as _getAll,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { SymptomEntry } from '@/lib/types';

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

/** All symptom entries, in insertion order. */
export function getAllSymptomEntries(): SymptomEntry[] {
  return _getAll();
}

/** Symptom entries for a date range [startDate, endDate] inclusive. */
export function getSymptomEntriesForRange(startDate: string, endDate: string): SymptomEntry[] {
  return _getAll().filter((e) => e.date >= startDate && e.date <= endDate);
}

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/** Add a symptom event (per-event rows — no daily uniqueness). */
export async function addSymptomEntry(entry: SymptomEntry): Promise<void> {
  // Step 1: localStorage
  _add(entry);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('symptom_logs').upsert({
    id:                   entry.id,
    user_id:              ctx.userId,
    logged_date:          entry.date,
    symptom_name:         entry.name,
    onset_at:             entry.onsetAt,
    duration_minutes:     entry.durationMin ?? null,
    severity:             entry.severity,
    trigger_tag:          entry.trigger ?? null,
    action_taken:         entry.actionTaken ?? null,
    note:                 entry.note ?? null,
    related_meal_id:      entry.relatedMealId ?? null,
    related_meal_name:    entry.relatedMealName ?? null,
    related_workout_id:   entry.relatedWorkoutId ?? null,
    related_workout_name: entry.relatedWorkoutName ?? null,
    created_at:           entry.addedAt,
  }, { onConflict: 'id' });

  if (error) {
    console.warn('[data/symptoms] Supabase addSymptomEntry failed:', error.message);
  }
}

export async function removeSymptomEntry(id: string): Promise<void> {
  // Step 1: localStorage
  _remove(id);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase
    .from('symptom_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.userId);

  if (error) {
    console.warn('[data/symptoms] Supabase removeSymptomEntry failed:', error.message);
  }
}
