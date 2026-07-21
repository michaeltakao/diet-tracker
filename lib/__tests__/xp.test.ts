/**
 * lib/xp.ts round-trip tests — same jsdom localStorage stub pattern as
 * steps.test.ts / favorites.test.ts. Supabase isn't configured in the test
 * environment, so getWriteContext() naturally short-circuits to null and
 * the dual-write leg is a no-op guest-mode path (nothing further to mock).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addXp, getXpState } from '../xp';

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

describe('getXpState (empty)', () => {
  it('defaults to 0 XP / E-rank when nothing is stored', () => {
    expect(getXpState()).toEqual({ totalXp: 0, highestRank: 'E' });
  });
});

describe('addXp', () => {
  it('accumulates XP across multiple calls', async () => {
    await addXp(null, 'quest_meal', 10);
    await addXp(null, 'quest_workout', 20);
    expect(getXpState().totalXp).toBe(30);
  });

  it('round-trips through localStorage (guest mode, userId=null)', async () => {
    await addXp(null, 'quest_water', 5);
    expect(getXpState()).toEqual({ totalXp: 5, highestRank: 'E' });
  });

  it('ratchets highestRank up when XP crosses a threshold', async () => {
    const state = await addXp(null, 'quest_all_complete', 500);
    expect(state.highestRank).toBe('D');
    expect(getXpState().highestRank).toBe('D');
  });

  it('highestRank is monotonic — does not fall back down implicitly', async () => {
    await addXp(null, 'quest_all_complete', 1500); // → C
    expect(getXpState().highestRank).toBe('C');
    await addXp(null, 'quest_water', 5); // tiny increment, still C-range
    expect(getXpState().highestRank).toBe('C');
  });

  it('negative amount does not reduce XP below current total', async () => {
    await addXp(null, 'quest_meal', 100);
    await addXp(null, 'quest_meal', -1000);
    expect(getXpState().totalXp).toBe(100);
  });

  it('accepts a userId without throwing when Supabase is unconfigured (fire-and-forget no-op)', async () => {
    await expect(addXp('user-123', 'quest_workout', 20)).resolves.toEqual({
      totalXp: 20,
      highestRank: 'E',
    });
  });
});
