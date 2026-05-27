/**
 * Badge data access layer.
 *
 * Currently delegates to lib/storage.ts (localStorage).
 * STEP 6: replace internals with Supabase queries when user is authenticated.
 */

import {
  getBadges as _getAll,
  hasBadge as _has,
  addBadge as _add,
  checkAndAwardBadges as _checkAndAward,
  getStreak as _getStreak,
} from '@/lib/storage';
import type { Badge, BadgeType } from '@/lib/types';

// ── Read ──────────────────────────────────────────────────────

/** All earned badges, sorted by earnedAt descending. */
export function getBadges(): Badge[] {
  return _getAll().sort(
    (a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime(),
  );
}

/**
 * Whether the user has earned a badge of this type.
 * Pass `date` (YYYY-MM-DD) for per-day badges (water_goal, calorie_goal).
 */
export function hasBadge(type: BadgeType, date?: string): boolean {
  return _has(type, date);
}

/** Current consecutive day streak (food logging). */
export function getStreak(): number {
  return _getStreak();
}

// ── Write ─────────────────────────────────────────────────────

export function addBadge(badge: Badge): void {
  _add(badge);
}

/**
 * Check all badge conditions for today and award any newly earned ones.
 * @returns array of newly awarded badges (empty if none).
 */
export function checkAndAwardBadges(today: string): Badge[] {
  return _checkAndAward(today);
}
