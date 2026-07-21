/**
 * WorkoutPrefs (P0 #9) tests: lossless migration from the pre-P0#9
 * {environment, equipment} shape, new-shape round trip, recordLocationChoice
 * cap behavior, and malformed-JSON fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWorkoutPrefs, saveWorkoutPrefs, recordLocationChoice,
} from '../data/workout-prefs';

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

let ls: ReturnType<typeof makeLocalStorage>;

beforeEach(() => {
  ls = makeLocalStorage();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', ls);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const KEY = 'diet-tracker:workout-prefs';

describe('getWorkoutPrefs — legacy migration', () => {
  it('migrates {environment: "home", equipment: [...]} losslessly', () => {
    ls.setItem(KEY, JSON.stringify({ environment: 'home', equipment: ['dumbbell', 'bodyweight'] }));
    const prefs = getWorkoutPrefs();
    expect(prefs.lastLocation).toBe('home');
    expect(prefs.equipmentByLocation.home).toEqual(['dumbbell', 'bodyweight']);
    expect(prefs.recentLocations).toEqual([]);
  });

  it('migrates {environment: "gym", equipment: []} — no equipment entry written when empty', () => {
    ls.setItem(KEY, JSON.stringify({ environment: 'gym', equipment: [] }));
    const prefs = getWorkoutPrefs();
    expect(prefs.lastLocation).toBe('gym');
    expect(prefs.equipmentByLocation.gym).toBeUndefined();
  });

  it('attributes a bare equipment list (no environment) to home', () => {
    ls.setItem(KEY, JSON.stringify({ equipment: ['barbell'] }));
    const prefs = getWorkoutPrefs();
    expect(prefs.lastLocation).toBeUndefined();
    expect(prefs.equipmentByLocation.home).toEqual(['barbell']);
  });

  it('drops unknown equipment values during migration', () => {
    ls.setItem(KEY, JSON.stringify({ environment: 'home', equipment: ['dumbbell', 'jetpack'] }));
    const prefs = getWorkoutPrefs();
    expect(prefs.equipmentByLocation.home).toEqual(['dumbbell']);
  });
});

describe('getWorkoutPrefs / saveWorkoutPrefs — new-shape round trip', () => {
  it('round-trips a full new-shape object', () => {
    const prefs = {
      lastLocation: 'gym' as const,
      equipmentByLocation: { gym: ['barbell', 'dumbbell'] as const, home: ['bodyweight'] as const },
      lastDuration: 45 as const,
      recentLocations: [
        { date: '2026-07-20', location: 'gym' as const },
        { date: '2026-07-18', location: 'home' as const },
      ],
    };
    saveWorkoutPrefs(prefs as never);
    const read = getWorkoutPrefs();
    expect(read.lastLocation).toBe('gym');
    expect(read.lastDuration).toBe(45);
    expect(read.equipmentByLocation.gym).toEqual(['barbell', 'dumbbell']);
    expect(read.equipmentByLocation.home).toEqual(['bodyweight']);
    expect(read.recentLocations).toEqual(prefs.recentLocations);
  });

  it('drops an invalid lastLocation/lastDuration on read', () => {
    ls.setItem(KEY, JSON.stringify({
      lastLocation: 'space_station', lastDuration: 99, equipmentByLocation: {}, recentLocations: [],
    }));
    const prefs = getWorkoutPrefs();
    expect(prefs.lastLocation).toBeUndefined();
    expect(prefs.lastDuration).toBeUndefined();
  });
});

describe('recordLocationChoice', () => {
  it('prepends the newest choice (most-recent-first)', () => {
    recordLocationChoice('home', '2026-07-18');
    recordLocationChoice('gym', '2026-07-19');
    const prefs = getWorkoutPrefs();
    expect(prefs.recentLocations[0]).toEqual({ date: '2026-07-19', location: 'gym' });
    expect(prefs.recentLocations[1]).toEqual({ date: '2026-07-18', location: 'home' });
  });

  it('caps recentLocations at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      recordLocationChoice('home', `2026-01-${String(i + 1).padStart(2, '0')}`);
    }
    const prefs = getWorkoutPrefs();
    expect(prefs.recentLocations).toHaveLength(20);
    // Most recent (i=24 → date 2026-01-25) stays at the front.
    expect(prefs.recentLocations[0].date).toBe('2026-01-25');
  });
});

describe('getWorkoutPrefs — malformed input fallback', () => {
  it('returns empty prefs on invalid JSON', () => {
    ls.setItem(KEY, '{not json');
    const prefs = getWorkoutPrefs();
    expect(prefs).toEqual({ equipmentByLocation: {}, recentLocations: [] });
  });

  it('returns empty prefs when nothing stored', () => {
    const prefs = getWorkoutPrefs();
    expect(prefs).toEqual({ equipmentByLocation: {}, recentLocations: [] });
  });

  it('SSR-safe: returns empty prefs when window is undefined', () => {
    vi.unstubAllGlobals();
    const prefs = getWorkoutPrefs();
    expect(prefs).toEqual({ equipmentByLocation: {}, recentLocations: [] });
  });
});
