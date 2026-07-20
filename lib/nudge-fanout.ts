/**
 * Server-side nudge fan-out helpers for the push-send cron (FTUE P0 #7,
 * server-side back half).
 *
 * Pure/DI, mirrors lib/push-send.ts's style: no Supabase client, no clock
 * reads — app/api/push-send-cron/route.ts supplies rows and the current
 * JST day/hour.
 *
 * Design decision — streak.current is a strict lower bound, computed WITHOUT
 * the repair-ticket rule at all:
 * lib/streak.ts's computeStreak() needs a StreakState (longest +
 * repairedDates, the "one gap day per ISO week may be bridged" repair
 * ticket) to match what a user sees in the app. That state lives only in
 * localStorage — there is no Supabase table for it — so the cron cannot
 * reconstruct it.
 *
 * An earlier version of this module called computeStreak() with a fresh,
 * empty StreakState ({ longest: 0, repairedDates: [] }) instead — that is
 * NOT a safe lower bound. Verified by simulation: if a client has already
 * spent this ISO week's repair ticket on an earlier gap (persisted in
 * repairedDates from a prior day's walk), the client's real streak breaks
 * at a *later* gap in the same week, while a fresh empty-state walk — which
 * has no memory of that earlier spend — is free to use the unused-looking
 * ticket on the later gap and keeps counting. That produces a server
 * current *higher* than the client's real one, which could fire
 * streak-at-risk for a user whose real streak is already broken — the
 * unsafe direction.
 *
 * currentStreakNoRepair() below instead walks back from today and breaks on
 * the FIRST gap, full stop — the repair-ticket rule (rules 3/4 in
 * computeStreak's doc comment) is never applied. Since a repair ticket can
 * only ever *extend* a streak that would otherwise have broken there (never
 * shorten one), disabling it entirely is provably conservative: for any
 * activity-day set and any real client StreakState, the client's real
 * current-streak (computed by computeStreak(), with or without a repair
 * history) is always >= this function's result. Under-counting can only
 * suppress a nudge the user would have gotten (a missed push, recoverable
 * next app open via the correct client-side streak) — never fire an
 * incorrect one.
 *
 * Design decision — lastDismissedDay is always null:
 * decideNudge's dismissal gate exists to stop in-app banner spam on repeat
 * visits, not to model whether a user wants to be reached while the app is
 * closed. Reaching a closed app is push's entire reason to exist, so the
 * cron never treats an in-app dismissal as suppressing a push.
 */

import { decideNudge, type NudgeInput } from './notifications';
import { shiftDate, MAX_WALK_DAYS } from './streak';

export interface UserLogDates {
  userId: string;
  lang: 'ja' | 'en';
  /** JST calendar days with any logged activity (see activityDaysFrom in streak.ts). */
  activityDays: ReadonlySet<string>;
}

/**
 * Current consecutive-day streak ending `today`, walked WITHOUT the
 * repair-ticket rule (see module doc for why this is a provable lower bound
 * on the client's real streak, not merely a documented approximation).
 * Mirrors computeStreak()'s today-grace (rule 2) and increment (rule 1)
 * behavior exactly; omits rules 3/4 (bridging) entirely — any gap other
 * than today breaks the walk.
 */
export function currentStreakNoRepair(days: ReadonlySet<string>, today: string): number {
  let current = 0;
  let day = today;
  for (let i = 0; i < MAX_WALK_DAYS; i++, day = shiftDate(day, -1)) {
    if (days.has(day)) {
      current++;
      continue;
    }
    if (i === 0) continue; // today-grace, matches computeStreak
    break;
  }
  return current;
}

/**
 * Reconstruct today's NudgeInput for one user from Supabase-sourced activity
 * days. streak.current comes from currentStreakNoRepair() — see module doc
 * for why this is a provable lower bound rather than the user's real
 * (repair-ticket-aware) streak.
 */
export function buildNudgeInputFor(
  user: UserLogDates,
  today: string,
  hour: number,
): NudgeInput {
  return {
    activityDays: user.activityDays,
    streak: { current: currentStreakNoRepair(user.activityDays, today) },
    today,
    hour,
    lastDismissedDay: null,
  };
}

/** Convenience: run buildNudgeInputFor + decideNudge for one user. */
export function decideNudgeFor(user: UserLogDates, today: string, hour: number) {
  return decideNudge(buildNudgeInputFor(user, today, hour));
}

/**
 * Group raw (user_id, logged_date) rows from N log tables into one
 * Map<userId, Set<date>> — union across all tables/queries passed in,
 * matching activityDaysFrom()'s "any-log" definition (the caller is
 * responsible for pre-filtering e.g. water_logs to total_ml > 0 before
 * calling this, since that filter is table-specific).
 */
export function groupActivityDaysByUser(
  rows: ReadonlyArray<{ user_id: string; logged_date: string }>,
): Map<string, Set<string>> {
  const byUser = new Map<string, Set<string>>();
  for (const row of rows) {
    let days = byUser.get(row.user_id);
    if (!days) {
      days = new Set<string>();
      byUser.set(row.user_id, days);
    }
    days.add(row.logged_date);
  }
  return byUser;
}
