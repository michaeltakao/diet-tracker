/**
 * app/auth/callback/route.ts pure-function tests (open-redirect guard).
 * No network, no Supabase — resolveSafeNext is a pure string transform.
 */
import { describe, it, expect } from 'vitest';
import { resolveSafeNext } from './route';

const ORIGIN = 'https://diet-tracker-two-blue.vercel.app';

describe('resolveSafeNext', () => {
  it('passes through a same-origin relative path', () => {
    expect(resolveSafeNext('/dashboard', ORIGIN)).toBe('/dashboard');
  });

  it('preserves search and hash on a same-origin path', () => {
    expect(resolveSafeNext('/workout?day=3#top', ORIGIN)).toBe('/workout?day=3#top');
  });

  it('defaults to / when next is missing/empty', () => {
    expect(resolveSafeNext('', ORIGIN)).toBe('/');
  });

  it('rejects protocol-relative paths (scheme-relative open redirect)', () => {
    expect(resolveSafeNext('//evil.com', ORIGIN)).toBe('/');
    expect(resolveSafeNext('//evil.com/phish', ORIGIN)).toBe('/');
  });

  it('rejects absolute URLs to a different origin', () => {
    expect(resolveSafeNext('https://evil.com', ORIGIN)).toBe('/');
    expect(resolveSafeNext('http://diet-tracker-two-blue.vercel.app.evil.com', ORIGIN)).toBe('/');
  });

  it('rejects other schemes', () => {
    expect(resolveSafeNext('javascript:alert(1)', ORIGIN)).toBe('/');
  });

  it('rejects unparseable input by falling back to /', () => {
    expect(resolveSafeNext('   ', ORIGIN)).toBe('/');
  });

  it('allows an absolute URL that happens to match the same origin', () => {
    expect(resolveSafeNext(`${ORIGIN}/settings`, ORIGIN)).toBe('/settings');
  });
});
