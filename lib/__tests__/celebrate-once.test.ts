import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hasCelebrated, markCelebrated } from '../celebrate-once';

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
  vi.stubGlobal('localStorage', ls);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasCelebrated / markCelebrated', () => {
  it('returns false for a key that was never marked', () => {
    expect(hasCelebrated('diet-tracker-ring-celebrated:2026-07-21')).toBe(false);
  });

  it('returns true after marking the same key', () => {
    const key = 'diet-tracker-ring-celebrated:2026-07-21';
    markCelebrated(key);
    expect(hasCelebrated(key)).toBe(true);
  });

  it('keeps distinct keys independent', () => {
    markCelebrated('diet-tracker-category-celebrated:2026-W29:meal');
    expect(hasCelebrated('diet-tracker-category-celebrated:2026-W29:workout')).toBe(false);
    expect(hasCelebrated('diet-tracker-category-celebrated:2026-W29:meal')).toBe(true);
  });

  it('hasCelebrated does not throw when localStorage access fails', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('unavailable'); },
    });
    expect(() => hasCelebrated('x')).not.toThrow();
    expect(hasCelebrated('x')).toBe(false);
  });

  it('markCelebrated does not throw when localStorage access fails', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new Error('unavailable'); },
    });
    expect(() => markCelebrated('x')).not.toThrow();
  });
});
