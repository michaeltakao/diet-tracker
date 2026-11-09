/** ADR-008 P0-2: a failed localStorage write returns false and fires the notice. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { saveAppData, safeSetItem, getAppData, STORAGE_ERROR_EVENT } from '../storage';
import { setSteps } from '../data/steps';

function quotaError(): Error {
  const e = new Error('The quota has been exceeded.');
  e.name = 'QuotaExceededError';
  return e;
}

function stubWindow() {
  const target = new EventTarget();
  const events: CustomEvent[] = [];
  target.addEventListener(STORAGE_ERROR_EVENT, (e) => events.push(e as CustomEvent));
  vi.stubGlobal('window', target);
  return events;
}

describe('safeSetItem / saveAppData', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saveAppData with a throwing setItem returns false and fires the notice', () => {
    const events = stubWindow();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw quotaError(); },
      removeItem: () => {},
    });
    expect(saveAppData(getAppData())).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ key: 'diet-tracker-v1', error: 'QuotaExceededError' });
  });

  it('returns true and fires nothing when the write succeeds', () => {
    const events = stubWindow();
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    expect(safeSetItem('k', 'v')).toBe(true);
    expect(store.get('k')).toBe('v');
    expect(events).toHaveLength(0);
  });

  it('module writers (steps) go through it too', async () => {
    const events = stubWindow();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw quotaError(); },
      removeItem: () => {},
    });
    await setSteps('2026-11-09', 5000);
    expect(events.map((e) => (e.detail as { key: string }).key)).toContain('diet-tracker-steps');
  });

  it('server side (no window) is a no-op false', () => {
    expect(safeSetItem('k', 'v')).toBe(false);
  });
});
