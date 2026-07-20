/**
 * Manual step tracking (phase D) — localStorage-first, Supabase dual-write.
 * Modeled directly on lib/data/water.ts: one row per (user, day), UPSERT.
 *
 * `setSteps` is the SOLE write entry point (2026-07-17 decision: manual
 * input now, swappable to a device source later without a schema change —
 * a future native wrapper passes source:'device' through this same call).
 */

import { getWriteContext } from './_write';

const KEY = 'diet-tracker-steps';

type StepsBySource = Record<string, { steps: number; source: 'manual' | 'device' }>;

function readAll(): StepsBySource {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StepsBySource) : {};
  } catch {
    return {};
  }
}

function writeAll(data: StepsBySource): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// ── Read (localStorage, synchronous) ──────────────────────────────────────────

/** Steps logged for a date (YYYY-MM-DD). Returns 0 if no record. */
export function getStepsForDate(date: string): number {
  return readAll()[date]?.steps ?? 0;
}

/** Full date → steps map. */
export function getAllStepsByDate(): Record<string, number> {
  return Object.fromEntries(
    Object.entries(readAll()).map(([date, v]) => [date, v.steps]),
  );
}

/** Steps for a date range [startDate, endDate] inclusive. */
export function getStepsForRange(startDate: string, endDate: string): Record<string, number> {
  const all = readAll();
  return Object.fromEntries(
    Object.entries(all)
      .filter(([date]) => date >= startDate && date <= endDate)
      .map(([date, v]) => [date, v.steps]),
  );
}

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

/**
 * Set the step count for a date (overwrites, matching the SQL UNIQUE
 * (user_id, logged_date) — re-entering the same day updates it).
 */
export async function setSteps(
  date: string,
  steps: number,
  source: 'manual' | 'device' = 'manual',
): Promise<void> {
  // Step 1: localStorage
  const all = readAll();
  all[date] = { steps, source };
  writeAll(all);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('steps_logs').upsert({
    user_id:     ctx.userId,
    logged_date: date,
    steps,
    source,
  }, { onConflict: 'user_id,logged_date' });

  if (error) {
    console.warn('[data/steps] Supabase setSteps failed:', error.message);
  }
}
