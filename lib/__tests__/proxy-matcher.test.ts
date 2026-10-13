/**
 * Proxy matcher tests — which paths the proxy runs on at all.
 *
 * Why these exist: the matcher excluded static files by extension only, so
 * the extension-less generated icons (`/icon`, `/apple-icon`, linked from
 * every page's <head>) went through the auth guard and anonymous visitors
 * got a 307 to /login instead of the image. That was found by curl against
 * production, not by CI; these tests pin the exclusion list and the fact
 * that page routes stay guarded.
 *
 * `unstable_doesMiddlewareMatch` compiles `config.matcher` the way Next
 * does, so this asserts on real matching rather than a hand-built RegExp.
 */
import { describe, it, expect } from 'vitest';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config } from '@/proxy';

const runsOn = (path: string) =>
  unstable_doesMiddlewareMatch({ config, url: `https://app.example.com${path}` });

describe('proxy matcher', () => {
  it.each([
    '/icon',
    '/apple-icon',
    '/icon?2bba5360dae7aa85',
    '/favicon.ico',
    '/manifest.webmanifest',
    '/sw.js',
    '/robots.txt',
    '/sitemap.xml',
    '/logo.png',
    '/_next/static/chunks/main.js',
    '/_next/image?url=%2Fa.png&w=64&q=75',
    '/api/recommend',
  ])('skips %s', (path) => {
    expect(runsOn(path)).toBe(false);
  });

  it.each([
    '/',
    '/dashboard',
    '/login',
    '/consent',
    '/onboarding',
    '/settings',
    '/workout',
  ])('runs on page route %s', (path) => {
    expect(runsOn(path)).toBe(true);
  });

  // The icon exclusions are anchored: only the exact paths are skipped.
  it.each(['/icons', '/icon/extra', '/iconography', '/apple-icon-x', '/settings/icon'])(
    'still runs on %s',
    (path) => {
      expect(runsOn(path)).toBe(true);
    },
  );
});
