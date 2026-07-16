import { describe, it, expect } from 'vitest';
import { decideNudge, NUDGE_TEMPLATES, type NudgeInput } from '../notifications';
import { activityDaysFrom } from '../streak';

const TODAY = '2026-07-16';

function input(overrides: Partial<NudgeInput> = {}): NudgeInput {
  return {
    activityDays: new Set<string>(),
    streak: { current: 0 },
    today: TODAY,
    hour: 20,
    lastDismissedDay: null,
    ...overrides,
  };
}

describe('decideNudge', () => {
  it('streak-at-risk only fires in the evening (hour >= 18)', () => {
    const base = {
      activityDays: new Set(['2026-07-15', '2026-07-14', '2026-07-13']),
      streak: { current: 3 },
    };
    expect(decideNudge(input({ ...base, hour: 12 })).kind).toBe('none');
    expect(decideNudge(input({ ...base, hour: 18 })).kind).toBe('streak-at-risk');
  });

  it('does not fire streak-at-risk when today already has activity', () => {
    const d = decideNudge(input({
      activityDays: new Set([TODAY, '2026-07-15', '2026-07-14']),
      streak: { current: 3 },
      hour: 21,
    }));
    expect(d.kind).toBe('none');
  });

  it('a dismissal today silences every nudge until tomorrow', () => {
    const d = decideNudge(input({
      activityDays: new Set(['2026-07-15', '2026-07-14', '2026-07-13']),
      streak: { current: 3 },
      lastDismissedDay: TODAY,
    }));
    expect(d.kind).toBe('none');
    // Yesterday's dismissal does not carry over.
    const d2 = decideNudge(input({
      activityDays: new Set(['2026-07-15', '2026-07-14', '2026-07-13']),
      streak: { current: 3 },
      lastDismissedDay: '2026-07-15',
    }));
    expect(d2.kind).toBe('streak-at-risk');
  });

  it('decay fires when ≤1 activity day in [today-3 … today]', () => {
    // Established user (5 lifetime days), only one recent day, no streak.
    const d = decideNudge(input({
      activityDays: new Set(['2026-07-14', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04']),
      streak: { current: 0 },
      hour: 9,
    }));
    expect(d.kind).toBe('decay');
    // Two recent days → no decay.
    const d2 = decideNudge(input({
      activityDays: new Set(['2026-07-14', '2026-07-15', '2026-07-01', '2026-07-02']),
      streak: { current: 0 },
      hour: 9,
    }));
    expect(d2.kind).toBe('none');
  });

  it('fresh installs (<3 lifetime activity days) never see the decay nudge', () => {
    const d = decideNudge(input({
      activityDays: new Set(['2026-07-01', '2026-07-02']),
      streak: { current: 0 },
      hour: 9,
    }));
    expect(d.kind).toBe('none');
  });

  it('streak-at-risk takes priority over decay in the evening', () => {
    // Streak alive via yesterday, but the decay window is also sparse:
    // only 1 activity day in [today-3 … today] and ≥3 lifetime days.
    const d = decideNudge(input({
      activityDays: new Set(['2026-07-15', '2026-07-01', '2026-07-02']),
      streak: { current: 1 },
      hour: 20,
    }));
    expect(d.kind).toBe('streak-at-risk');
    expect(d.kind === 'streak-at-risk' && d.template).toBe(NUDGE_TEMPLATES['streak-at-risk']);
  });

  it('zero streak in the evening falls through to the decay rule', () => {
    const d = decideNudge(input({
      activityDays: new Set(['2026-07-01', '2026-07-02', '2026-07-03']),
      streak: { current: 0 },
      hour: 20,
    }));
    expect(d.kind).toBe('decay');
    expect(d.kind === 'decay' && d.template.href).toBe('/');
  });

  it('a water-only day counts as activity (any-log)', () => {
    const days = activityDaysFrom({
      foodEntries: [],
      workoutEntries: [],
      weightEntries: [],
      waterByDate: { [TODAY]: 200 },
    });
    const d = decideNudge(input({
      activityDays: days,
      streak: { current: 1 },
      hour: 21,
    }));
    expect(d.kind).toBe('none'); // logged today via water → no streak-at-risk
  });
});
