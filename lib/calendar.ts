/**
 * Month-calendar math — pure functions (phase C).
 *
 * Mon-start weeks (ISO convention, matching lib/streak.ts weekStartOf) of
 * JST YYYY-MM-DD day strings. All arithmetic delegates to lib/streak.ts
 * shiftDate/weekStartOf so month/year/leap handling stays in one place.
 */

import { shiftDate, weekStartOf } from '@/lib/streak';

/**
 * Full-week grid covering a month.
 *
 * Parameters
 * ----------
 * year : full year (e.g. 2026)
 * month : 1–12
 *
 * Returns
 * -------
 * Array of Mon-start weeks (string[7] of YYYY-MM-DD), from the week
 * containing the 1st through the week containing the last day. Leading and
 * trailing out-of-month days are included (callers style them dimmed).
 */
export function monthGrid(year: number, month: number): string[][] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthFirst = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = shiftDate(nextMonthFirst, -1);

  const weeks: string[][] = [];
  let cursor = weekStartOf(first);
  const end = weekStartOf(last);
  // ≤ 6 weeks always cover one month; hard cap keeps any bug from looping.
  for (let i = 0; i < 6 && cursor <= end; i++) {
    weeks.push(Array.from({ length: 7 }, (_, d) => shiftDate(cursor, d)));
    cursor = shiftDate(cursor, 7);
  }
  return weeks;
}

/** Shift a (year, month 1–12) pair by delta months. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12 + 12) % 12 + 1 };
}
