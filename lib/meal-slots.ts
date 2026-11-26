/**
 * Meal-slot helpers for the home screen and slot-scoped logging (UX P0,
 * docs/ux-audit/REDESIGN_PROPOSAL.md §2–3). Pure functions over FoodEntry[]
 * so they are unit-testable without localStorage.
 *
 * Dates are JST calendar days (YYYY-MM-DD, lib/format-date.ts); ordering
 * within a day uses `addedAt` (ISO instant).
 */
import type { FoodEntry } from './types';
import { sumIntake } from './macros';

export type MealSlot = FoodEntry['mealType'];

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** The three main meals; snack never counts toward "n/3 meals". */
export const MAIN_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export function isMealSlot(v: unknown): v is MealSlot {
  return typeof v === 'string' && (MEAL_SLOTS as readonly string[]).includes(v);
}

/** Entries grouped by slot, each group in logging order. */
export function groupBySlot(entries: readonly FoodEntry[]): Record<MealSlot, FoodEntry[]> {
  const out: Record<MealSlot, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const e of entries) out[e.mealType]?.push(e);
  for (const s of MEAL_SLOTS) out[s].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return out;
}

/** Main slots (breakfast/lunch/dinner) with at least one entry. */
export function filledMainSlots(entries: readonly FoodEntry[]): MealSlot[] {
  const g = groupBySlot(entries);
  return MAIN_SLOTS.filter((s) => g[s].length > 0);
}

export interface LastSlotMeal {
  date: string;
  entries: FoodEntry[];
  calories: number;
}

/**
 * The most recent earlier day's meal in `slot` (every entry of that slot on
 * the latest date before `today`). This is what "log the same" repeats:
 * a meal is often several entries (rice + miso soup + main), so repeating
 * only the last entry would under-log it. `null` when there is none.
 */
export function lastSlotMeal(all: readonly FoodEntry[], slot: MealSlot, today: string): LastSlotMeal | null {
  let date: string | null = null;
  for (const e of all) {
    if (e.mealType === slot && e.date < today && (date === null || e.date > date)) date = e.date;
  }
  if (date === null) return null;
  const entries = all
    .filter((e) => e.mealType === slot && e.date === date)
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  return { date, entries, calories: sumIntake(entries).calories };
}

/**
 * Up to `limit` distinct foods (by name) most recently logged in `slot`,
 * newest first. Same dedupe rule as lib/storage.ts getRecentFoods.
 */
export function recentForSlot(all: readonly FoodEntry[], slot: MealSlot, limit = 3): FoodEntry[] {
  const sorted = all
    .filter((e) => e.mealType === slot)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const e of sorted) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * A copy of `src` logged now in `slot` on `date`: new id, new timestamp,
 * no photo (neither the local data URL nor the stored photo_url: nobody
 * photographed the repeat). Provenance (source/sourceId/servings/macrosEntered) is kept, so
 * a repeated kcal-only meal stays kcal-only.
 */
export function repeatEntry(src: FoodEntry, slot: MealSlot, date: string, addedAt: string, id: string): FoodEntry {
  return { ...src, id, date, mealType: slot, addedAt, photoDataUrl: undefined, photo_url: undefined };
}

/**
 * Start of each slot in JST minutes after midnight — the single boundary
 * table for /add's preselection and the home "next step" (lib/next-action).
 */
export const SLOT_START_MIN: Readonly<Record<MealSlot, number>> = {
  breakfast: 0,
  lunch: 11 * 60,
  dinner: 16 * 60,
  snack: 21 * 60,
};

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Slot the /add form preselects from the JST wall clock (HH:MM). */
export function guessSlotForTime(hhmm: string): MealSlot {
  const now = hhmmToMinutes(hhmm);
  let slot: MealSlot = 'breakfast';
  for (const s of MEAL_SLOTS) if (now >= SLOT_START_MIN[s]) slot = s;
  return slot;
}

// ── Copy yesterday (UX P0 slice 3) ──────────────────────────────────────────

export type CopyPlan =
  | { ok: true; entries: FoodEntry[]; calories: number }
  | { ok: false; reason: 'empty' | 'already-copied' };

/**
 * What "copy yesterday" would add. `copiedOn` is the JST day the copy was
 * last done on this device; a second copy on the same day is refused, which
 * is what stopped the double-tap duplicates (UX_AUDIT #3).
 */
export function planCopyYesterday(
  all: readonly FoodEntry[],
  today: string,
  yesterday: string,
  copiedOn: string | null,
): CopyPlan {
  if (copiedOn === today) return { ok: false, reason: 'already-copied' };
  const entries = all.filter((e) => e.date === yesterday);
  if (entries.length === 0) return { ok: false, reason: 'empty' };
  return { ok: true, entries, calories: sumIntake(entries).calories };
}
