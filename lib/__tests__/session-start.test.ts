/**
 * Pure session-start helpers (P0 #9): energy-scale mapping, default-location
 * picking from recent history, and the location→equipment default table.
 */
import { describe, it, expect } from 'vitest';
import {
  energyLevelToScale, pickDefaultLocation, LOCATION_EQUIPMENT_DEFAULTS,
} from '../session-start';

describe('energyLevelToScale', () => {
  it('maps low/medium/high onto the 1-5 DailyCheckIn.energy scale', () => {
    expect(energyLevelToScale('low')).toBe(2);
    expect(energyLevelToScale('medium')).toBe(3);
    expect(energyLevelToScale('high')).toBe(4);
  });
});

describe('LOCATION_EQUIPMENT_DEFAULTS', () => {
  it('covers every TrainingLocation with an array value', () => {
    const locations = ['home', 'gym', 'hotel_gym', 'outdoor', 'rest_day'] as const;
    for (const loc of locations) {
      expect(Array.isArray(LOCATION_EQUIPMENT_DEFAULTS[loc])).toBe(true);
    }
  });

  it('home and rest_day assume no equipment', () => {
    expect(LOCATION_EQUIPMENT_DEFAULTS.home).toEqual([]);
    expect(LOCATION_EQUIPMENT_DEFAULTS.rest_day).toEqual([]);
  });

  it('hotel_gym mirrors gym (documented simplest-default choice)', () => {
    expect(LOCATION_EQUIPMENT_DEFAULTS.hotel_gym).toEqual(LOCATION_EQUIPMENT_DEFAULTS.gym);
  });

  it('outdoor assumes bodyweight only', () => {
    expect(LOCATION_EQUIPMENT_DEFAULTS.outdoor).toEqual(['bodyweight']);
  });
});

describe('pickDefaultLocation', () => {
  it('returns fallback when there is no history at all', () => {
    expect(pickDefaultLocation([], 1, 'gym')).toBe('gym');
    expect(pickDefaultLocation([], 1)).toBeUndefined();
  });

  it('falls back to the single most-recent choice when no same-weekday match exists', () => {
    // 2026-07-20 is a Monday (weekday 1); history entries are Tuesdays (weekday 2).
    const history = [
      { date: '2026-07-21', location: 'gym' as const },
      { date: '2026-07-14', location: 'home' as const },
    ];
    expect(pickDefaultLocation(history, 1)).toBe('gym');
  });

  it('picks the most common location on the same weekday', () => {
    // All Mondays (weekday 1): 2026-07-20, 2026-07-13, 2026-07-06.
    const history = [
      { date: '2026-07-20', location: 'gym' as const },
      { date: '2026-07-13', location: 'gym' as const },
      { date: '2026-07-06', location: 'home' as const },
    ];
    expect(pickDefaultLocation(history, 1)).toBe('gym');
  });

  it('breaks ties by most-recent (history is most-recent-first)', () => {
    // Two Mondays, one each — tie broken toward the most-recent entry.
    const history = [
      { date: '2026-07-20', location: 'home' as const }, // most recent Monday
      { date: '2026-07-13', location: 'gym' as const },
    ];
    expect(pickDefaultLocation(history, 1)).toBe('home');
  });

  it('ignores unparseable dates in the history', () => {
    const history = [{ date: 'not-a-date', location: 'gym' as const }];
    // No valid same-weekday match, but the malformed entry is still the
    // "most recent choice overall" fallback path if it doesn't crash Date parsing.
    expect(() => pickDefaultLocation(history, 1, 'home')).not.toThrow();
  });
});
