import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStoredEasyMode, setEasyMode } from '../easy-mode';

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
  // getStoredEasyMode is SSR-safe (`typeof window === 'undefined'` → false);
  // this suite's environment is 'node' (vitest.config.ts), so `window` is
  // undefined by default. Stub it to exercise the client-side storage path,
  // same as a real browser would present it.
  vi.stubGlobal('window', {});
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getStoredEasyMode / setEasyMode', () => {
  it('defaults to false when never set', () => {
    expect(getStoredEasyMode()).toBe(false);
  });

  it('returns true after setEasyMode(true)', () => {
    setEasyMode(true);
    expect(getStoredEasyMode()).toBe(true);
  });

  it('returns false after setEasyMode(false) following a true', () => {
    setEasyMode(true);
    setEasyMode(false);
    expect(getStoredEasyMode()).toBe(false);
  });

  it('returns false when window is undefined (SSR), regardless of storage', () => {
    setEasyMode(true);
    vi.stubGlobal('window', undefined);
    expect(getStoredEasyMode()).toBe(false);
  });

  it('getStoredEasyMode does not throw when localStorage access fails', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('unavailable'); },
    });
    expect(() => getStoredEasyMode()).not.toThrow();
    expect(getStoredEasyMode()).toBe(false);
  });

  it('setEasyMode does not throw when localStorage access fails', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => { throw new Error('unavailable'); },
    });
    expect(() => setEasyMode(true)).not.toThrow();
  });
});
