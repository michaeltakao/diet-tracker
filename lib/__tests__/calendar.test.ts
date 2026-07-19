import { describe, it, expect } from 'vitest';
import { monthGrid, shiftMonth } from '@/lib/calendar';

describe('monthGrid', () => {
  it('produces Mon-start weeks covering July 2026', () => {
    const weeks = monthGrid(2026, 7);
    // 2026-07-01 is a Wednesday → first week starts Mon 2026-06-29.
    expect(weeks[0][0]).toBe('2026-06-29');
    expect(weeks[0][2]).toBe('2026-07-01');
    // 2026-07-31 is a Friday → last week starts Mon 2026-07-27, ends Sun 08-02.
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek[0]).toBe('2026-07-27');
    expect(lastWeek[6]).toBe('2026-08-02');
    expect(weeks.length).toBe(5);
    for (const w of weeks) expect(w.length).toBe(7);
  });

  it('handles leap February (2028) and non-leap (2026)', () => {
    const leap = monthGrid(2028, 2).flat();
    expect(leap).toContain('2028-02-29');
    const nonLeap = monthGrid(2026, 2).flat();
    expect(nonLeap).not.toContain('2026-02-29');
    expect(nonLeap).toContain('2026-02-28');
  });

  it('February starting on Monday spans exactly 4 weeks (2027-02)', () => {
    // 2027-02-01 is a Monday and Feb 2027 has 28 days.
    const weeks = monthGrid(2027, 2);
    expect(weeks.length).toBe(4);
    expect(weeks[0][0]).toBe('2027-02-01');
    expect(weeks[3][6]).toBe('2027-02-28');
  });

  it('crosses the year boundary (December → January days)', () => {
    const weeks = monthGrid(2026, 12);
    const flat = weeks.flat();
    expect(flat).toContain('2026-12-01');
    expect(flat).toContain('2026-12-31');
    // 2026-12-31 is a Thursday → the last week runs into 2027.
    expect(flat).toContain('2027-01-01');
  });

  it('every week starts on Monday', () => {
    for (const weeks of [monthGrid(2026, 7), monthGrid(2028, 2), monthGrid(2026, 12)]) {
      for (const w of weeks) {
        const d = new Date(`${w[0]}T00:00:00Z`);
        expect(d.getUTCDay()).toBe(1);
      }
    }
  });
});

describe('shiftMonth', () => {
  it('shifts within a year and across year boundaries', () => {
    expect(shiftMonth(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 7, -19)).toEqual({ year: 2024, month: 12 });
    expect(shiftMonth(2026, 7, 0)).toEqual({ year: 2026, month: 7 });
  });
});
