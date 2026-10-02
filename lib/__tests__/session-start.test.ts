/**
 * Pure session-start helpers (P0 #9): energy-scale mapping, default-location
 * picking from recent history, and the location→equipment default table.
 */
import { describe, it, expect } from 'vitest';
import {
  energyLevelToScale, pickDefaultLocation, LOCATION_EQUIPMENT_DEFAULTS,
  profileGoalToTrainingGoal, toTimeAvailableMin, toRecentMuscleParts, nextSwapCandidate,
} from '../session-start';
import { alternativesFor, type GeneratePlanInput } from '@/lib/workout-generator';
import type { MusclePart, WorkoutEntry } from '@/lib/types';

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

// ── Engine-input adapters (P0 #9: SessionStart → deterministic generator) ───

describe('profileGoalToTrainingGoal', () => {
  it('maps the goals that have a direct generator equivalent', () => {
    expect(profileGoalToTrainingGoal('weight_loss')).toBe('weight_loss');
    expect(profileGoalToTrainingGoal('muscle_gain')).toBe('hypertrophy');
    expect(profileGoalToTrainingGoal('endurance')).toBe('endurance');
  });

  it('falls back to hypertrophy for goals with no generator equivalent', () => {
    expect(profileGoalToTrainingGoal('maintenance')).toBe('hypertrophy');
    expect(profileGoalToTrainingGoal('flexibility')).toBe('hypertrophy');
  });

  it('falls back to hypertrophy when the profile has no goal set', () => {
    expect(profileGoalToTrainingGoal(undefined)).toBe('hypertrophy');
  });

  it('always returns a goal the generator accepts', () => {
    const valid = ['hypertrophy', 'strength', 'endurance', 'weight_loss'];
    for (const g of ['weight_loss', 'muscle_gain', 'maintenance', 'endurance', 'flexibility'] as const) {
      expect(valid).toContain(profileGoalToTrainingGoal(g));
    }
  });
});

describe('toTimeAvailableMin', () => {
  it('passes the supported budget steps through unchanged', () => {
    expect(toTimeAvailableMin(15)).toBe(15);
    expect(toTimeAvailableMin(30)).toBe(30);
    expect(toTimeAvailableMin(45)).toBe(45);
    expect(toTimeAvailableMin(60)).toBe(60);
  });

  it('rounds down so a plan never overruns the stated time', () => {
    expect(toTimeAvailableMin(44)).toBe(30);
    expect(toTimeAvailableMin(59)).toBe(45);
    expect(toTimeAvailableMin(90)).toBe(60);
  });

  it('clamps below-minimum durations up to the smallest step', () => {
    expect(toTimeAvailableMin(5)).toBe(15);
    expect(toTimeAvailableMin(0)).toBe(15);
  });

  it('defaults to 30 when no duration was chosen', () => {
    expect(toTimeAvailableMin(undefined)).toBe(30);
  });
});

describe('toRecentMuscleParts', () => {
  const entry = (date: string, musclePart?: MusclePart): WorkoutEntry => ({
    id: `${date}-${musclePart ?? 'none'}`,
    date,
    name: 'test',
    category: 'strength',
    musclePart,
    addedAt: `${date}T00:00:00Z`,
  });

  it('computes daysAgo relative to the given today', () => {
    const out = toRecentMuscleParts([entry('2026-09-15', 'chest')], '2026-09-18');
    expect(out).toEqual([{ musclePart: 'chest', daysAgo: 3 }]);
  });

  it('treats a workout logged today as daysAgo 0', () => {
    const out = toRecentMuscleParts([entry('2026-09-18', 'legs')], '2026-09-18');
    expect(out).toEqual([{ musclePart: 'legs', daysAgo: 0 }]);
  });

  it('keeps only the most recent day per muscle part', () => {
    const out = toRecentMuscleParts([
      entry('2026-09-10', 'back'),
      entry('2026-09-17', 'back'),
      entry('2026-09-12', 'back'),
    ], '2026-09-18');
    expect(out).toEqual([{ musclePart: 'back', daysAgo: 1 }]);
  });

  it('skips entries with no muscle part (cardio and similar)', () => {
    const out = toRecentMuscleParts([entry('2026-09-17'), entry('2026-09-17', 'arms')], '2026-09-18');
    expect(out).toEqual([{ musclePart: 'arms', daysAgo: 1 }]);
  });

  it('ignores future-dated entries rather than trusting a negative daysAgo', () => {
    const out = toRecentMuscleParts([entry('2026-09-20', 'abs')], '2026-09-18');
    expect(out).toEqual([]);
  });

  it('returns one entry per distinct part, in first-seen order', () => {
    const out = toRecentMuscleParts([
      entry('2026-09-17', 'legs'),
      entry('2026-09-16', 'chest'),
      entry('2026-09-15', 'legs'),
    ], '2026-09-18');
    expect(out.map((r) => r.musclePart)).toEqual(['legs', 'chest']);
  });

  it('returns an empty array for no entries', () => {
    expect(toRecentMuscleParts([], '2026-09-18')).toEqual([]);
  });

  it('returns an empty array when today is unparseable rather than throwing', () => {
    expect(toRecentMuscleParts([entry('2026-09-17', 'chest')], 'not-a-date')).toEqual([]);
  });

  it('is a pure function: same input yields the same output', () => {
    const entries = [entry('2026-09-17', 'legs'), entry('2026-09-16', 'chest')];
    expect(toRecentMuscleParts(entries, '2026-09-18'))
      .toEqual(toRecentMuscleParts(entries, '2026-09-18'));
  });
});

describe('nextSwapCandidate', () => {
  /** Swap one plan slot k times, the way SessionStart does, and return each exercise shown. */
  function swapSlot(start: string, k: number, others: string[] = []): string[] {
    const input: GeneratePlanInput = { goal: 'hypertrophy', availableEquipment: ['barbell', 'dumbbell', 'machine', 'cable'], timeAvailableMin: 45 };
    let current = start;
    let swappedOut: Set<string> = new Set();
    const shown = [current];
    for (let i = 0; i < k; i++) {
      const pool = alternativesFor(input, current).map((e) => e.id);
      const next = nextSwapCandidate(pool, new Set([current, ...others]), new Set([...swappedOut, current]));
      if (!next) break;
      current = next.id;
      swappedOut = next.swappedOut;
      shown.push(current);
    }
    return shown;
  }

  it('k swaps of one slot show k+1 distinct exercises (regression: A↔B toggle)', () => {
    const shown = swapSlot('bench-press', 5);
    expect(shown).toHaveLength(6);
    expect(new Set(shown).size).toBe(6);
  });

  it('never offers an exercise already in the plan', () => {
    const others = ['dumbbell-fly', 'incline-dumbbell-press'];
    for (const id of swapSlot('bench-press', 10, others)) expect(others).not.toContain(id);
  });

  it('visits the whole pool, then wraps instead of getting stuck', () => {
    const pool = ['a', 'b', 'c'];
    const r1 = nextSwapCandidate(pool, new Set(['x']), new Set(['x', 'a', 'b', 'c']));
    expect(r1?.id).toBe('a');
    // Pool ids are forgotten on wrap; ids outside the pool (the current one) are kept.
    expect([...r1!.swappedOut].sort()).toEqual(['x']);
    expect(nextSwapCandidate(pool, new Set(['x']), new Set(['x', 'a']))?.id).toBe('b');
  });

  it('returns null when every alternative is already in the plan, or the pool is empty', () => {
    expect(nextSwapCandidate(['a', 'b'], new Set(['x', 'a', 'b']), new Set(['x']))).toBeNull();
    expect(nextSwapCandidate([], new Set(['x']), new Set(['x']))).toBeNull();
  });

  it('does not mutate the swappedOut it is given', () => {
    const given = new Set(['x', 'a', 'b']);
    nextSwapCandidate(['a', 'b'], new Set(['x']), given);
    expect([...given]).toEqual(['x', 'a', 'b']);
  });
});
