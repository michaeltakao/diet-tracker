/**
 * lib/export.ts importFromFile — exerciseRanks merge validation.
 *
 * Regression test for a CodeRabbit finding (2026-07-25): the exerciseRanks
 * merge in importFromFile persisted unvalidated incoming entries from a
 * restored backup file (`incoming = parsed.data as AppData` is a raw cast
 * with no runtime validation upstream — untrusted JSON). A malformed rank
 * string would have reached EXERCISE_RANK_TIERS[state.rank] as undefined at
 * render time. Same jsdom localStorage stub pattern as steps.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importFromFile } from '../export';
import { getAppData } from '../storage';

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', makeLocalStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFile(payload: unknown): File {
  const json = JSON.stringify(payload);
  return {
    text: async () => json,
  } as unknown as File;
}

const EMPTY_APP_DATA_FIELDS = {
  foodEntries: [], workoutEntries: [], weightEntries: [],
  goals: { calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 },
  waterByDate: {}, badges: [], personalRecords: {}, recommendationFeedback: [],
  favoriteFoods: [], mealTemplates: [], streakState: { longest: 0, repairedDates: [] },
  vitalEntries: [], symptomEntries: [], xp: 0, highestRank: 'E' as const, earnedTitles: [],
};

describe('importFromFile — exerciseRanks merge validation', () => {
  it('accepts a valid exerciseRanks entry', async () => {
    const file = makeFile({
      data: {
        ...EMPTY_APP_DATA_FIELDS,
        exerciseRanks: { 'bench-press': { rank: 'advanced', achievedAt: '2026-07-01T00:00:00.000Z' } },
      },
    });
    const result = await importFromFile(file);
    expect(result.success).toBe(true);
    expect(getAppData().exerciseRanks['bench-press']?.rank).toBe('advanced');
  });

  it('rejects a malformed rank string (would otherwise crash rendering)', async () => {
    const file = makeFile({
      data: {
        ...EMPTY_APP_DATA_FIELDS,
        exerciseRanks: { 'bench-press': { rank: 'legendary', achievedAt: '2026-07-01T00:00:00.000Z' } },
      },
    });
    const result = await importFromFile(file);
    expect(result.success).toBe(true);
    expect(getAppData().exerciseRanks['bench-press']).toBeUndefined();
  });

  it('rejects an "unranked" rank value (never a valid persisted state)', async () => {
    const file = makeFile({
      data: {
        ...EMPTY_APP_DATA_FIELDS,
        exerciseRanks: { 'bench-press': { rank: 'unranked', achievedAt: '2026-07-01T00:00:00.000Z' } },
      },
    });
    await importFromFile(file);
    expect(getAppData().exerciseRanks['bench-press']).toBeUndefined();
  });

  it('rejects an entry missing achievedAt', async () => {
    const file = makeFile({
      data: {
        ...EMPTY_APP_DATA_FIELDS,
        exerciseRanks: { 'bench-press': { rank: 'novice' } },
      },
    });
    await importFromFile(file);
    expect(getAppData().exerciseRanks['bench-press']).toBeUndefined();
  });

  it('rejects a null entry without throwing', async () => {
    const file = makeFile({
      data: {
        ...EMPTY_APP_DATA_FIELDS,
        exerciseRanks: { 'bench-press': null },
      },
    });
    const result = await importFromFile(file);
    expect(result.success).toBe(true);
    expect(getAppData().exerciseRanks['bench-press']).toBeUndefined();
  });

  it('keeps the higher-ranked entry on conflict between current and incoming', async () => {
    // Seed current state with an 'elite' bench-press rank.
    const seedFile = makeFile({
      data: {
        ...EMPTY_APP_DATA_FIELDS,
        exerciseRanks: { 'bench-press': { rank: 'elite', achievedAt: '2026-07-01T00:00:00.000Z' } },
      },
    });
    await importFromFile(seedFile);
    expect(getAppData().exerciseRanks['bench-press']?.rank).toBe('elite');

    // Importing a lower 'novice' entry for the same exercise must not downgrade.
    const lowerFile = makeFile({
      data: {
        ...EMPTY_APP_DATA_FIELDS,
        exerciseRanks: { 'bench-press': { rank: 'novice', achievedAt: '2026-07-02T00:00:00.000Z' } },
      },
    });
    await importFromFile(lowerFile);
    expect(getAppData().exerciseRanks['bench-press']?.rank).toBe('elite');
  });

  it('handles a missing exerciseRanks field gracefully (older backups)', async () => {
    const file = makeFile({ data: { ...EMPTY_APP_DATA_FIELDS } });
    const result = await importFromFile(file);
    expect(result.success).toBe(true);
    expect(getAppData().exerciseRanks).toEqual({});
  });
});
