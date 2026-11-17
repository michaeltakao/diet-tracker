import type { FoodEntry } from './types';

/**
 * Intake totals for a set of food entries (ADR-011, migration 029).
 *
 * kcal-only entries (`macrosEntered === false`) carry 0 g placeholders for
 * P/F/C, not measurements. They count toward calories but never toward the
 * macro sums. `kcalOnlyCount > 0` therefore means the macro sums are a lower
 * bound, not the day's real intake. Entries without the flag predate 029,
 * when P/F/C were mandatory, so they count as entered.
 */
export interface IntakeTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Entries whose P/F/C were entered (sums are over these). */
  enteredCount: number;
  /** kcal-only entries excluded from the P/F/C sums. */
  kcalOnlyCount: number;
}

export function sumIntake(entries: readonly FoodEntry[]): IntakeTotals {
  const t: IntakeTotals = { calories: 0, protein: 0, fat: 0, carbs: 0, enteredCount: 0, kcalOnlyCount: 0 };
  for (const e of entries) {
    t.calories += e.calories;
    if (e.macrosEntered === false) {
      t.kcalOnlyCount += 1;
      continue;
    }
    t.enteredCount += 1;
    t.protein += e.protein;
    t.fat += e.fat;
    t.carbs += e.carbs;
  }
  return t;
}

/**
 * All-or-nothing rule for P/F/C input: either all three are given or none.
 * `null` = valid; otherwise the fields that are missing.
 */
export function partialMacroFields<K extends string>(fields: Record<K, boolean>): K[] | null {
  const keys = Object.keys(fields) as K[];
  const given = keys.filter((k) => fields[k]);
  if (given.length === 0 || given.length === keys.length) return null;
  return keys.filter((k) => !fields[k]);
}
