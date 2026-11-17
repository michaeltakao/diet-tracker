/**
 * Streak read access for the data layer.
 *
 * The streak UI was deleted with the gamification layer (ADR-011), but the
 * streak value is still an input to the safe recommender
 * (components/RecommendationCard.tsx) and to the push-nudge decision
 * (lib/notifications.ts), so the read path stays.
 */

import {
  getStreak as _getStreak,
  getStreakState as _getStreakState,
  type StreakSummary,
} from '@/lib/storage';

/** Current consecutive day streak (any-log, JST). */
export function getStreak(): number {
  return _getStreak();
}

/** Streak + longest + repair-ticket availability (any-log, JST). */
export function getStreakState(): StreakSummary {
  return _getStreakState();
}
