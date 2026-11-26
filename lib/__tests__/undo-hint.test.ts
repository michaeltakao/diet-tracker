import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setUndoHint, takeUndoHint } from '../undo-hint';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('undo hint', () => {
  it('is taken exactly once', () => {
    setUndoHint(['a', 'b'], 'x', 1000);
    expect(takeUndoHint(2000)).toEqual({ ids: ['a', 'b'], label: 'x', at: 1000 });
    expect(takeUndoHint(2000)).toBeNull();
  });

  it('expires after maxAge', () => {
    setUndoHint(['a'], 'x', 1000);
    expect(takeUndoHint(1000 + 10_001)).toBeNull();
  });

  it('rejects malformed payloads', () => {
    sessionStorage.setItem('diet-tracker:undo-hint', '{"ids":"a"}');
    expect(takeUndoHint()).toBeNull();
    sessionStorage.setItem('diet-tracker:undo-hint', 'not json');
    expect(takeUndoHint()).toBeNull();
  });
});
