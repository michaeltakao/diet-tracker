// Pin the timezone before any Date is constructed so the UTC-vs-local
// divergence this suite asserts is reproducible on UTC CI machines too
// (the dev machine is already JST). Asia/Tokyo is UTC+9, no DST.
process.env.TZ = 'Asia/Tokyo';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { toLocalDateStr, todayLocal } from '../format-date';

describe('toLocalDateStr', () => {
  it('formats a Date as YYYY-MM-DD using local calendar fields', () => {
    // Built from local components → must echo them back regardless of host TZ.
    expect(toLocalDateStr(new Date(2026, 0, 15, 23, 59))).toBe('2026-01-15');
  });

  it('zero-pads single-digit months and days', () => {
    // monthIndex 2 === March.
    expect(toLocalDateStr(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('returns the LOCAL day, not the UTC day, in early-morning JST', () => {
    // 2026-01-15 02:30 JST === 2026-01-14 17:30 UTC.
    const instant = new Date('2026-01-15T02:30:00+09:00');
    expect(toLocalDateStr(instant)).toBe('2026-01-15');
    // The previous (buggy) toISOString approach yielded the UTC day instead.
    expect(instant.toISOString().split('T')[0]).toBe('2026-01-14');
    expect(toLocalDateStr(instant)).not.toBe(instant.toISOString().split('T')[0]);
  });
});

describe('todayLocal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today as a local-time YYYY-MM-DD string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T12:00:00+09:00'));
    expect(todayLocal()).toBe('2026-06-13');
  });

  it('does not roll back to the previous day during the JST/UTC early-morning gap', () => {
    vi.useFakeTimers();
    // 05:00 JST on Mar 1 is still Feb 28 20:00 UTC — the boundary the old code got wrong.
    vi.setSystemTime(new Date('2026-03-01T05:00:00+09:00'));
    expect(todayLocal()).toBe('2026-03-01');
    // Demonstrate the regression that the UTC approach would have produced.
    expect(new Date().toISOString().split('T')[0]).toBe('2026-02-28');
    expect(todayLocal()).not.toBe(new Date().toISOString().split('T')[0]);
  });
});
