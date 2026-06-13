import { describe, expect, it } from 'vitest';
import { safeParse } from '../json';

describe('safeParse', () => {
  it('parses well-formed JSON into the expected value', () => {
    expect(safeParse('{"a":1,"b":[2,3]}', {})).toEqual({ a: 1, b: [2, 3] });
    expect(safeParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns the fallback for malformed JSON without throwing', () => {
    expect(safeParse('{not valid', { ok: true })).toEqual({ ok: true });
    expect(() => safeParse('{broken', [])).not.toThrow();
  });

  it('returns the fallback for null input', () => {
    expect(safeParse(null, [])).toEqual([]);
  });

  it('returns the fallback for an empty string', () => {
    expect(safeParse('', { d: 1 })).toEqual({ d: 1 });
  });

  it('preserves the fallback reference identity on miss', () => {
    const fb = { default: true };
    expect(safeParse(null, fb)).toBe(fb);
  });

  it('round-trips primitives under the declared type parameter', () => {
    expect(safeParse<number>('42', 0)).toBe(42);
    expect(safeParse<boolean>('true', false)).toBe(true);
    expect(safeParse<string>('"hi"', '')).toBe('hi');
  });
});
