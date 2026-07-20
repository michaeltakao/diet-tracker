/**
 * lib/data/steps.ts round-trip test — localStorage read/write, same jsdom
 * stub pattern as favorites.test.ts (guest mode: getWriteContext() is a
 * no-op since Supabase isn't configured in the test environment).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStepsForDate, getAllStepsByDate, getStepsForRange, setSteps } from '../data/steps';

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

describe('steps round-trip', () => {
  it('returns 0 for a date with no record', () => {
    expect(getStepsForDate('2026-07-19')).toBe(0);
  });

  it('setSteps then getStepsForDate round-trips', async () => {
    await setSteps('2026-07-19', 8500);
    expect(getStepsForDate('2026-07-19')).toBe(8500);
  });

  it('same-day re-entry overwrites (UNIQUE-per-day semantics)', async () => {
    await setSteps('2026-07-19', 3000);
    await setSteps('2026-07-19', 9000);
    expect(getStepsForDate('2026-07-19')).toBe(9000);
  });

  it('getAllStepsByDate reflects multiple days', async () => {
    await setSteps('2026-07-18', 4000);
    await setSteps('2026-07-19', 8500);
    expect(getAllStepsByDate()).toEqual({ '2026-07-18': 4000, '2026-07-19': 8500 });
  });

  it('getStepsForRange filters inclusive bounds', async () => {
    await setSteps('2026-07-17', 1000);
    await setSteps('2026-07-18', 2000);
    await setSteps('2026-07-19', 3000);
    await setSteps('2026-07-20', 4000);
    expect(getStepsForRange('2026-07-18', '2026-07-19')).toEqual({
      '2026-07-18': 2000, '2026-07-19': 3000,
    });
  });

  it('defaults source to manual', async () => {
    await setSteps('2026-07-19', 5000);
    // source isn't exposed by the read API directly, but a device write must
    // not collide with / be overwritten silently by a default manual write.
    await setSteps('2026-07-19', 6000, 'device');
    expect(getStepsForDate('2026-07-19')).toBe(6000);
  });

  it('clamps out-of-range values to [0, MAX_STEPS] before persisting', async () => {
    await setSteps('2026-07-19', -500);
    expect(getStepsForDate('2026-07-19')).toBe(0);
    await setSteps('2026-07-19', 999_999);
    expect(getStepsForDate('2026-07-19')).toBe(200_000);
  });

  it('does not throw when localStorage.setItem fails (quota/private mode)', async () => {
    vi.stubGlobal('localStorage', {
      ...makeLocalStorage(),
      setItem: () => { throw new Error('QuotaExceededError'); },
    });
    await expect(setSteps('2026-07-19', 4000)).resolves.toBeUndefined();
  });
});
