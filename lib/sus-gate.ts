/**
 * SUS survey display gate (FTUE roadmap P0 #10, Day-14 UEQ/SUS journey gate).
 *
 * Pure/DI, same idiom as lib/notifications.ts: dates are injected so
 * components/SusSurveyCard.tsx (the only caller) supplies the clock and
 * localStorage-backed dismiss state, and tests control both deterministically.
 *
 * Rules, in priority order:
 * 1. Never shown to a user who hasn't consented (consentedAt === null) —
 *    the survey is research instrumentation, gated the same as any other
 *    research-only surface.
 * 2. Never shown again once already submitted.
 * 3. Not shown before 14 days have elapsed since consent (JST calendar days,
 *    inclusive of day 14 itself).
 * 4. Shown at most once after a dismissal on the *same* JST day — i.e. a
 *    dismissal hides it for the rest of that day, but it reappears once on a
 *    later day. dismissCount caps total *dismissals* the caller may choose to
 *    honor (e.g. stop asking after N dismissals); this module only decides
 *    same-day suppression, the caller decides how to interpret dismissCount
 *    beyond that (kept here as an input for that future extensibility, not
 *    acted on directly beyond documenting the contract).
 */

const DAYS_UNTIL_ELIGIBLE = 14;

export interface SusGateInput {
  /** ISO timestamp of consent, or null if the user has not consented. */
  consentedAt: string | null;
  /** JST calendar day (YYYY-MM-DD), "today" per streak.ts jstToday(). */
  today: string;
  alreadySubmitted: boolean;
  /** How many times the user has dismissed the card (informational; see doc above). */
  dismissCount: number;
  /** JST day of the last dismissal, or null if never dismissed. */
  lastDismissedDay: string | null;
}

export interface SusGateDecision {
  show: boolean;
}

/** Whole JST calendar days between two YYYY-MM-DD strings (b - a). */
function daysBetween(a: string, b: string): number {
  const msA = Date.parse(`${a}T00:00:00Z`);
  const msB = Date.parse(`${b}T00:00:00Z`);
  return Math.round((msB - msA) / 86_400_000);
}

export function decideSusShow(input: SusGateInput): SusGateDecision {
  const { consentedAt, today, alreadySubmitted, lastDismissedDay } = input;

  if (!consentedAt) return { show: false };
  if (alreadySubmitted) return { show: false };

  const consentedDay = consentedAt.slice(0, 10);
  if (daysBetween(consentedDay, today) < DAYS_UNTIL_ELIGIBLE) return { show: false };

  if (lastDismissedDay === today) return { show: false };

  return { show: true };
}
