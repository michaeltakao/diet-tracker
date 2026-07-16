/**
 * Streak-nudge trigger rules + templates (FTUE roadmap P0 #7).
 *
 * Pure decision module: date and hour are injected so tests (and a future
 * server-side web-push round) control the clock. No localStorage, no DOM —
 * components/NudgeBanner.tsx wires this to the dashboard.
 *
 * Guardrails (FTUE §6.3/§7.1, no dark patterns):
 * - At most ONE nudge per JST day; a dismissal silences everything until
 *   tomorrow.
 * - Repair-first copy: "one log keeps it going" — never loss-threat framing.
 * - Fresh installs (fewer than 3 lifetime activity days) never see the decay
 *   nudge; there is no habit to decay yet.
 */

import type { TranslationKey } from './i18n';
import { shiftDate } from './streak';

const JST_OFFSET_MS = 9 * 3_600_000;

/** Current hour-of-day (0–23) in JST — clock twin of streak.ts jstToday(). */
export function jstHour(now: number = Date.now()): number {
  return new Date(now + JST_OFFSET_MS).getUTCHours();
}

export type NudgeKind = 'streak-at-risk' | 'decay';

export interface NudgeTemplate {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  ctaKey: TranslationKey;
  /** Where the CTA sends the user (client route). */
  href: string;
}

/**
 * Keyed by kind so a future web-push round can reuse the same templates
 * server-side (i18n keys, not baked strings).
 */
export const NUDGE_TEMPLATES: Record<NudgeKind, NudgeTemplate> = {
  'streak-at-risk': {
    titleKey: 'nudgeStreakTitle',
    bodyKey: 'nudgeStreakBody',
    ctaKey: 'nudgeStreakCta',
    href: '/add',
  },
  decay: {
    titleKey: 'nudgeDecayTitle',
    bodyKey: 'nudgeDecayBody',
    ctaKey: 'nudgeDecayCta',
    href: '/',
  },
};

export interface NudgeInput {
  /** Lifetime any-log activity days (streak.ts activityDaysFrom()). */
  activityDays: ReadonlySet<string>;
  streak: { current: number };
  /** JST calendar day (YYYY-MM-DD). */
  today: string;
  /** JST hour of day, 0–23. */
  hour: number;
  /** JST day of the last banner dismissal, or null if never dismissed. */
  lastDismissedDay: string | null;
}

export type NudgeDecision =
  | { kind: 'none' }
  | { kind: NudgeKind; template: NudgeTemplate };

/** Days (beyond today) the decay rule looks back over: [today-3 … today]. */
const DECAY_WINDOW_DAYS = 3;
/** Minimum lifetime activity days before decay nudges apply (fresh-install guard). */
const DECAY_MIN_LIFETIME_DAYS = 3;
/** Streak-at-risk fires only in the evening (JST). */
const EVENING_HOUR = 18;

/**
 * Decide which nudge (if any) to show right now. Rules in priority order:
 * 1. Dismissed today → none (max one nudge per day).
 * 2. Streak at risk: evening, nothing logged today, an active streak (≥1) to
 *    keep — "one more log keeps it going".
 * 3. Decay: at most one activity day in the last 4 days ([today-3 … today])
 *    for a user with an established habit (≥3 lifetime activity days).
 */
export function decideNudge(input: NudgeInput): NudgeDecision {
  const { activityDays, streak, today, hour, lastDismissedDay } = input;

  if (lastDismissedDay === today) return { kind: 'none' };

  const loggedToday = activityDays.has(today);

  if (hour >= EVENING_HOUR && !loggedToday && streak.current >= 1) {
    return { kind: 'streak-at-risk', template: NUDGE_TEMPLATES['streak-at-risk'] };
  }

  let recentDays = 0;
  for (let i = 0; i <= DECAY_WINDOW_DAYS; i++) {
    if (activityDays.has(shiftDate(today, -i))) recentDays++;
  }
  if (recentDays <= 1 && activityDays.size >= DECAY_MIN_LIFETIME_DAYS) {
    return { kind: 'decay', template: NUDGE_TEMPLATES.decay };
  }

  return { kind: 'none' };
}
