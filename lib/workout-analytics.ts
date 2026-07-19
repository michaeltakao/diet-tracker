/**
 * Training analytics — pure functions (phase C, spec C2/C3).
 *
 * Volume definition matches lib/workout-sets.ts: Σ weight×reps over sets,
 * kg. Entries with setDetails use the exact per-set sum; scalar entries
 * fall back to sets×reps×weight (the pre-phase-B storage shape).
 */

import type { MusclePart, WorkoutEntry } from '@/lib/types';
import { epley1RM, best1RM } from '@/lib/onerm';

const ALL_PARTS: readonly MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

/** Volume (kg) of one entry: exact per-set sum, else scalar product. */
function entryVolume(e: WorkoutEntry): number {
  if (e.setDetails && e.setDetails.length > 0) {
    return e.setDetails.reduce((sum, s) => sum + s.weight * s.reps, 0);
  }
  return (e.sets ?? 0) * (e.reps ?? 0) * (e.weight ?? 0);
}

/**
 * Total lifted volume per muscle part over [startDate, endDate] inclusive
 * (YYYY-MM-DD). Entries without a musclePart are skipped. Values rounded
 * to 0.1 kg; every part is present (0 when untrained).
 */
export function volumeByBodyPart(
  entries: ReadonlyArray<WorkoutEntry>,
  startDate: string,
  endDate: string,
): Record<MusclePart, number> {
  const totals = Object.fromEntries(ALL_PARTS.map((p) => [p, 0])) as Record<MusclePart, number>;
  for (const e of entries) {
    if (!e.musclePart || e.date < startDate || e.date > endDate) continue;
    totals[e.musclePart] += entryVolume(e);
  }
  for (const p of ALL_PARTS) totals[p] = Math.round(totals[p] * 10) / 10;
  return totals;
}

export interface ExerciseProgressPoint {
  date: string;
  /** Heaviest weight lifted that day, kg. */
  topWeight: number;
  /** Best Epley estimate that day, kg. */
  est1RM: number;
}

/**
 * Per-day progress series for one exercise (matched by canonical name),
 * ascending by date. Days where the exercise was logged with weight 0 only
 * (bodyweight) are skipped — a 0-kg line carries no progression signal.
 */
export function exerciseProgressSeries(
  entries: ReadonlyArray<WorkoutEntry>,
  name: string,
): ExerciseProgressPoint[] {
  const byDate = new Map<string, { topWeight: number; est1RM: number }>();
  for (const e of entries) {
    if (e.name !== name) continue;
    const sets = e.setDetails && e.setDetails.length > 0
      ? e.setDetails
      : [{ weight: e.weight ?? 0, reps: e.reps ?? 0 }];
    const top = Math.max(...sets.map((s) => s.weight));
    if (top <= 0) continue;
    const est = best1RM(sets.filter((s) => s.reps > 0));
    const cur = byDate.get(e.date);
    byDate.set(e.date, {
      topWeight: Math.max(cur?.topWeight ?? 0, top),
      est1RM: Math.max(cur?.est1RM ?? 0, est, epley1RM(top, 1)),
    });
  }
  return [...byDate.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Distinct exercise names with any weighted history, most recent first. */
export function weightedExerciseNames(entries: ReadonlyArray<WorkoutEntry>): string[] {
  const lastSeen = new Map<string, string>();
  for (const e of entries) {
    const top = e.setDetails && e.setDetails.length > 0
      ? Math.max(...e.setDetails.map((s) => s.weight))
      : e.weight ?? 0;
    if (top <= 0) continue;
    const prev = lastSeen.get(e.name);
    if (!prev || e.date > prev) lastSeen.set(e.name, e.date);
  }
  return [...lastSeen.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([name]) => name);
}
