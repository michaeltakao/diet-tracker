/**
 * Dashboard gamification adapter (design phase 5 — v0 integration).
 *
 * Replaces the v0 mock's hardcoded lib/dashboard-data.ts with real reads:
 * per-category logging stats derived from AppData plus the existing
 * streak / badge / weekly-challenge layers. Pure math lives in
 * computeCategoryStats (unit-tested, no clock/localStorage); the thin
 * getDashboardStats() getter wires it to the client data layer.
 *
 * No UI concerns here (icons/colors stay in components/dashboard/).
 * All dates are YYYY-MM-DD JST calendar days; "week" is the JST Mon–Sun
 * ISO week containing `today` (same convention as lib/streak.ts).
 */

import type { AppData } from '@/lib/types';
import { countActivityDaysInWeek, jstToday, weekStartOf } from '@/lib/streak';
import {
  getAppData,
  getBadges,
  getCurrentWeeklyChallenge,
  getStreakState,
  type WeeklyChallenge,
} from '@/lib/data';

export type CategoryKey = 'meal' | 'exercise' | 'vital' | 'symptom';

export const CATEGORY_KEYS: readonly CategoryKey[] = [
  'meal',
  'exercise',
  'vital',
  'symptom',
] as const;

export interface CategoryStat {
  key: CategoryKey;
  /** At least one entry of this category logged on `today` (binary). */
  loggedToday: boolean;
  /** Distinct logged days in the JST Mon–Sun week containing `today` (0–7). */
  weekDays: number;
}

export interface DashboardCategoryStats {
  categories: CategoryStat[];
  /** Share of the 4 categories logged today, 0–100 (binary per category). */
  todayPct: number;
}

type CategoryEntries = Pick<
  AppData,
  'foodEntries' | 'workoutEntries' | 'vitalEntries' | 'symptomEntries'
>;

/** Per-category today/this-week logging stats (pure — fixed `today` in tests). */
export function computeCategoryStats(
  data: CategoryEntries,
  today: string = jstToday(),
): DashboardCategoryStats {
  const dateSets: Record<CategoryKey, Set<string>> = {
    meal: new Set(data.foodEntries.map((e) => e.date)),
    exercise: new Set(data.workoutEntries.map((e) => e.date)),
    vital: new Set(data.vitalEntries.map((e) => e.date)),
    symptom: new Set(data.symptomEntries.map((e) => e.date)),
  };

  const weekStart = weekStartOf(today);
  const categories = CATEGORY_KEYS.map((key) => ({
    key,
    loggedToday: dateSets[key].has(today),
    weekDays: countActivityDaysInWeek(dateSets[key], weekStart),
  }));

  const logged = categories.filter((c) => c.loggedToday).length;
  return {
    categories,
    todayPct: Math.round((logged / CATEGORY_KEYS.length) * 100),
  };
}

export interface DashboardStats extends DashboardCategoryStats {
  /** Current any-log streak in days. */
  streak: number;
  /** Earned badge count (the v0 mock's "gems"). */
  badgeCount: number;
  /** This ISO week's streak-repair ticket still unused (the mock's "hearts"). */
  repairAvailable: boolean;
  challenge: WeeklyChallenge;
}

/** Client-side snapshot for the gamification dashboard (sync localStorage reads). */
export function getDashboardStats(): DashboardStats {
  const streakState = getStreakState();
  return {
    ...computeCategoryStats(getAppData()),
    streak: streakState.current,
    badgeCount: getBadges().length,
    repairAvailable: streakState.repairAvailable,
    challenge: getCurrentWeeklyChallenge(),
  };
}
