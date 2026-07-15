/**
 * Badge data access layer.
 *
 * Read:  localStorage always (synchronous, immediate).
 * Write: localStorage first; then Supabase when authenticated (async, fire-and-forget).
 *
 * STEP 6: dual-write added for addBadge.
 */

import {
  getBadges           as _getAll,
  hasBadge            as _has,
  addBadge            as _add,
  checkAndAwardBadges as _checkAndAward,
  getStreak           as _getStreak,
  getStreakState      as _getStreakState,
  type StreakSummary,
} from '@/lib/storage';
import { getWriteContext } from './_write';
import type { Badge, BadgeType } from '@/lib/types';
import type { BadgeTypeEnum } from '@/lib/database.types';

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

/** Current consecutive day streak (any-log: food / workout / weight / water). */
export function getStreak(): number {
  return _getStreak();
}

/** Streak + longest + repair-ticket availability (any-log, JST). */
export function getStreakState(): StreakSummary {
  return _getStreakState();
}

// ── Write (localStorage + Supabase dual-write) ────────────────────────────────

export async function addBadge(badge: Badge): Promise<void> {
  // Step 1: localStorage
  _add(badge);

  // Step 2: Supabase
  const ctx = await getWriteContext();
  if (!ctx) return;

  const { error } = await ctx.supabase.from('badges').insert({
    user_id:     ctx.userId,
    type:        badge.type as BadgeTypeEnum,
    name:        badge.name,
    description: badge.description,
    icon:        badge.icon,
    earned_at:   badge.earnedAt,
  });

  if (error) {
    console.warn('[data/badges] Supabase addBadge failed:', error.message);
  }
}

/**
 * Check all badge conditions for today and award any newly earned ones.
 * @returns array of newly awarded badges (empty if none).
 */
export async function checkAndAwardBadges(today: string): Promise<Badge[]> {
  const newBadges = _checkAndAward(today);

  if (newBadges.length === 0) return [];

  // Dual-write each new badge to Supabase
  const ctx = await getWriteContext();
  if (!ctx) return newBadges;

  const rows = newBadges.map(b => ({
    user_id:     ctx.userId,
    type:        b.type as BadgeTypeEnum,
    name:        b.name,
    description: b.description,
    icon:        b.icon,
    earned_at:   b.earnedAt,
  }));

  const { error } = await ctx.supabase.from('badges').insert(rows);
  if (error) {
    console.warn('[data/badges] Supabase checkAndAwardBadges failed:', error.message);
  }

  return newBadges;
}
