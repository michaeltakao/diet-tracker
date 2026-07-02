import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../gemini';

const transient = (status: number, msg = 'UNAVAILABLE') =>
  Object.assign(new Error(msg), { status });

describe('withRetry', () => {
  it('returns the first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(fn, { baseMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient (503) error then succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(transient(503)).mockResolvedValue('ok');
    expect(await withRetry(fn, { baseMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient (400) error', async () => {
    const err = transient(400, 'bad request');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { baseMs: 0 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error after exhausting attempts', async () => {
    const err = transient(503, 'overloaded');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { attempts: 3, baseMs: 0 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('detects transient errors by message when status is absent', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('The model is experiencing high demand'))
      .mockResolvedValue('ok');
    expect(await withRetry(fn, { baseMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
