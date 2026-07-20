/**
 * nudge-fanout unit tests (FTUE P0 #7, server-side back half).
 *
 * Pure suite, no Supabase, no vi.mock — matches lib/__tests__/push-send.test.ts
 * / notifications.test.ts idiom. TODAY mirrors notifications.test.ts's fixture
 * day for continuity with the existing decideNudge suite.
 */
import { describe, it, expect } from 'vitest';
import {
  buildNudgeInputFor,
  currentStreakNoRepair,
  decideNudgeFor,
  groupActivityDaysByUser,
  type UserLogDates,
} from '../nudge-fanout';
import { computeStreak } from '../streak';

const TODAY = '2026-07-16';

describe('groupActivityDaysByUser', () => {
  it('groups multi-user rows into per-user date sets', () => {
    const rows = [
      { user_id: 'u1', logged_date: '2026-07-14' },
      { user_id: 'u1', logged_date: '2026-07-15' },
      { user_id: 'u2', logged_date: '2026-07-15' },
    ];
    const byUser = groupActivityDaysByUser(rows);
    expect(byUser.get('u1')).toEqual(new Set(['2026-07-14', '2026-07-15']));
    expect(byUser.get('u2')).toEqual(new Set(['2026-07-15']));
  });

  it('a user with zero rows in some tables still ends up with the union of the rest', () => {
    // Simulates two tables' rows both passed in for the same user, one table empty.
    const foodRows = [{ user_id: 'u1', logged_date: '2026-07-10' }];
    const workoutRows: Array<{ user_id: string; logged_date: string }> = [];
    const byUser = groupActivityDaysByUser([...foodRows, ...workoutRows]);
    expect(byUser.get('u1')).toEqual(new Set(['2026-07-10']));
  });

  it('returns an empty map for no rows', () => {
    expect(groupActivityDaysByUser([]).size).toBe(0);
  });
});

describe('buildNudgeInputFor + decideNudge composition', () => {
  it('fires streak-at-risk in the evening with no activity today and an active streak', () => {
    const user: UserLogDates = {
      userId: 'u1',
      lang: 'en',
      activityDays: new Set(['2026-07-15', '2026-07-14', '2026-07-13']),
    };
    const decision = decideNudgeFor(user, TODAY, 20);
    expect(decision.kind).toBe('streak-at-risk');
  });

  it('fires decay for a sparse, established user outside the evening streak-at-risk window', () => {
    const user: UserLogDates = {
      userId: 'u2',
      lang: 'ja',
      activityDays: new Set(['2026-07-14', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']),
    };
    const decision = decideNudgeFor(user, TODAY, 9);
    expect(decision.kind).toBe('decay');
  });

  it('returns none when the user already logged today', () => {
    const user: UserLogDates = {
      userId: 'u3',
      lang: 'en',
      activityDays: new Set([TODAY, '2026-07-15', '2026-07-14']),
    };
    const decision = decideNudgeFor(user, TODAY, 21);
    expect(decision.kind).toBe('none');
  });

  it('lastDismissedDay is always null — an in-app dismissal never suppresses the cron push', () => {
    const user: UserLogDates = {
      userId: 'u4',
      lang: 'en',
      activityDays: new Set(['2026-07-15', '2026-07-14', '2026-07-13']),
    };
    const input = buildNudgeInputFor(user, TODAY, 20);
    expect(input.lastDismissedDay).toBeNull();
    expect(decideNudgeFor(user, TODAY, 20).kind).toBe('streak-at-risk');
  });

  it('currentStreakNoRepair never exceeds computeStreak on the same days/state (provable lower bound)', () => {
    // A single gap at 07-15, immediately before today, with the client having
    // already spent this ISO week's (2026-W29) repair ticket earlier (recorded
    // as a bridged 07-13 in client state — realistic if the user logged 07-13
    // retroactively after the app bridged it). The client's real walk
    // (computeStreak, repair-ticket-aware) has already used its one ticket
    // this week, so it cannot bridge the 07-15 gap and breaks immediately.
    const days = new Set(['2026-07-14', '2026-07-13', '2026-07-12', '2026-07-11', '2026-07-10']);
    const clientState = { longest: 0, repairedDates: ['2026-07-13'] };
    const clientComputation = computeStreak(days, clientState, TODAY);
    expect(clientComputation.current).toBe(0); // ticket already spent this week → breaks at the 07-15 gap

    // A naive fresh-empty-state computeStreak() call (the earlier, REJECTED
    // design) would instead treat the ticket as unused and bridge 07-15,
    // producing current=5 — HIGHER than the client's real 0. That is the
    // unsafe over-count this module must not reproduce.
    const naiveFreshWalk = computeStreak(days, { longest: 0, repairedDates: [] }, TODAY);
    expect(naiveFreshWalk.current).toBe(5); // pins the over-count this design avoids

    // currentStreakNoRepair (this module's actual approach) disables the
    // repair rule entirely, so it breaks at the very first gap (07-15) and
    // is provably <= any real client computation, including the naive one.
    const serverCurrent = currentStreakNoRepair(days, TODAY);
    expect(serverCurrent).toBe(0);
    expect(serverCurrent).toBeLessThanOrEqual(clientComputation.current);
    expect(serverCurrent).toBeLessThanOrEqual(naiveFreshWalk.current);

    // Composed through buildNudgeInputFor, same result.
    const user: UserLogDates = { userId: 'u5', lang: 'en', activityDays: days };
    expect(buildNudgeInputFor(user, TODAY, 20).streak.current).toBe(0);
  });
});
