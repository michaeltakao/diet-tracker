/**
 * Pure streak / calendar math for the engagement layer (FTUE roadmap 2026-07).
 *
 * Definitions
 * -----------
 * - Activity day ("any-log"): a JST calendar day with at least one food,
 *   workout, or weight entry, or water > 0 ml.
 * - Day boundary: JST (UTC+9), matching the SQL side's Asia/Tokyo day used by
 *   lib/api-guard.ts. All YYYY-MM-DD strings here are JST calendar days.
 * - Repair ticket: at most ONE gap day per ISO week may be bridged. A bridged
 *   day keeps the streak alive but does NOT count toward it (the streak is an
 *   honest count of logged days). Bridged days are persisted in
 *   StreakState.repairedDates so later recomputations bridge the same gaps —
 *   without that memory, a consumed ticket would break the streak on the very
 *   next reload.
 *
 * Pure module: no localStorage, no clock reads except jstToday()'s default.
 * lib/storage.ts wires it to AppData; tests exercise it directly.
 */

import type { AppData, StreakState } from './types';

const JST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

/** Walk/prune horizon in days: streaks and repair memory beyond this are dropped. */
export const MAX_WALK_DAYS = 400;

/** Today's date in JST as YYYY-MM-DD — mirrors lib/api-guard.ts jstDateString(). */
export function jstToday(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar-day arithmetic on YYYY-MM-DD strings (handles month/year/leap). */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO-8601 week key (e.g. "2026-W29") of a YYYY-MM-DD date. */
export function isoWeekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  // Shift to the Thursday of this ISO week — it determines the ISO year.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3,
  );
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday (ISO week start) of the week containing `date`. */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return shiftDate(date, -((d.getUTCDay() + 6) % 7));
}

/**
 * Union of activity days across all log types ("any-log" definition).
 * Water only counts when > 0 ml (a zeroed-out day is not activity).
 * Vitals count too: recording a BP/glucose measurement is logging activity.
 */
export function activityDaysFrom(
  data: Pick<AppData, 'foodEntries' | 'workoutEntries' | 'weightEntries' | 'waterByDate' | 'vitalEntries'>,
): Set<string> {
  const days = new Set<string>();
  for (const e of data.foodEntries) days.add(e.date);
  for (const e of data.workoutEntries) days.add(e.date);
  for (const e of data.weightEntries) days.add(e.date);
  for (const e of data.vitalEntries) days.add(e.date);
  for (const [date, ml] of Object.entries(data.waterByDate)) {
    if (ml > 0) days.add(date);
  }
  return days;
}

export interface StreakComputation {
  /** Consecutive-day streak ending today (or yesterday — today has grace). */
  current: number;
  /** max(previous longest, current). */
  longest: number;
  /** Bridged gap days after this walk, sorted ascending, pruned to the horizon. */
  repairedDates: string[];
  /** True when the current ISO week's repair ticket is still unused. */
  repairAvailable: boolean;
}

/**
 * Walk back from `today` (JST) over the activity-day set.
 *
 * Rules, in order, for each day:
 * 1. Activity → counts, continue.
 * 2. Today with no activity → grace: neither breaks nor consumes a ticket.
 * 3. Previously repaired gap → bridged (no count), continue.
 * 4. Fresh gap, this ISO week's ticket unused, AND the previous day has
 *    activity (look-ahead — never waste a ticket on a trailing gap that
 *    wouldn't extend the streak) → consume the ticket, bridge, continue.
 * 5. Otherwise → streak ends.
 */
export function computeStreak(
  days: ReadonlySet<string>,
  state: StreakState,
  today: string = jstToday(),
): StreakComputation {
  const repaired = new Set(state.repairedDates);
  const repairedWeeks = new Set(state.repairedDates.map(isoWeekKey));

  let current = 0;
  let day = today;
  for (let i = 0; i < MAX_WALK_DAYS; i++, day = shiftDate(day, -1)) {
    if (days.has(day)) {
      current++;
      continue;
    }
    if (i === 0) continue; // today-grace
    if (repaired.has(day)) continue; // already bridged
    if (!repairedWeeks.has(isoWeekKey(day)) && days.has(shiftDate(day, -1))) {
      repaired.add(day);
      repairedWeeks.add(isoWeekKey(day));
      continue;
    }
    break;
  }

  const cutoff = shiftDate(today, -MAX_WALK_DAYS);
  const repairedDates = [...repaired].filter((d) => d >= cutoff).sort();
  return {
    current,
    longest: Math.max(state.longest, current),
    repairedDates,
    repairAvailable: !repairedWeeks.has(isoWeekKey(today)),
  };
}

/** Distinct activity days within the 7-day window [weekStart, weekStart+6]. */
export function countActivityDaysInWeek(
  days: ReadonlySet<string>,
  weekStart: string,
): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (days.has(shiftDate(weekStart, i))) n++;
  }
  return n;
}
