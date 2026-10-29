/**
 * Proxy routing tests — the first tests against proxy.ts.
 *
 * Why these exist: proxy.ts had an onboarding gap where `needsOnboarding`
 * excluded the root page (`!isRootPage`), so a guest who had opted in
 * (dt-guest=1) but never finished onboarding was sent to /dashboard instead
 * of /onboarding when they returned to `/`. The first test below is the
 * direct regression test for that fix; the rest pin the surrounding branches
 * so the fix cannot silently break the landing-page or authed paths.
 *
 * Mocking strategy: proxy.ts calls `createServerClient()` from @supabase/ssr
 * and `NextResponse` from next/server, neither of which runs outside a Next
 * request context under vitest's `environment: 'node'`. Both are replaced
 * with minimal fakes that record what the proxy decided (redirect target, or
 * "pass through"), which is exactly the observable this suite asserts on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** The user getUser() should resolve to for the next proxy() call. */
let mockUser: { id: string } | null = null;

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser } }),
    },
    // No in-app consent gate since 2026-10-14: the proxy must not read
    // profiles at all. Any query fails the test that triggered it.
    from: () => {
      throw new Error('proxy must not query the database');
    },
  }),
}));

vi.mock('next/server', () => {
  class FakeResponse {
    constructor(
      public kind: 'next' | 'redirect',
      public redirectUrl: string | null = null,
    ) {}
    headers = new Map<string, string>();
    cookies = { set: () => {} };
  }
  return {
    NextResponse: {
      next: () => new FakeResponse('next'),
      redirect: (url: URL | string) => new FakeResponse('redirect', String(url)),
    },
  };
});

import { proxy } from '@/proxy';

/**
 * Build the minimal NextRequest surface proxy() actually touches:
 * `nextUrl` (pathname + clone + searchParams), `url`, `cookies`, `headers`.
 */
function makeRequest(pathname: string, cookies: Record<string, string> = {}) {
  const origin = 'https://app.example.com';
  const store = new Map(Object.entries(cookies));
  // proxy.ts calls nextUrl.clone(), which is a NextURL method, not a URL one.
  const makeNextUrl = (href: string): URL & { clone: () => URL } => {
    const u = new URL(href) as URL & { clone: () => URL };
    u.clone = () => makeNextUrl(u.href);
    return u;
  };
  return {
    url: `${origin}${pathname}`,
    nextUrl: makeNextUrl(`${origin}${pathname}`),
    headers: new Headers(),
    cookies: {
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
      getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => { store.set(name, value); },
    },
  };
}

/** Returns '/onboarding', '/dashboard', '/login', … for a redirect, or null for pass-through. */
async function routeOf(pathname: string, cookies: Record<string, string> = {}): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal NextRequest stand-in, see makeRequest
  const res = (await proxy(makeRequest(pathname, cookies) as any)) as unknown as {
    kind: 'next' | 'redirect';
    redirectUrl: string | null;
  };
  if (res.kind !== 'redirect') return null;
  return new URL(res.redirectUrl!).pathname;
}

beforeEach(() => {
  // Real-looking Supabase env so isSupabaseConfigured() returns true; without
  // this the proxy short-circuits at the top and every test trivially passes.
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb-anon-key-for-tests';
  mockUser = null;
});

describe('proxy onboarding gate — guest on the root page', () => {
  it('sends an un-onboarded guest hitting / to /onboarding (regression: the !isRootPage gap)', async () => {
    expect(await routeOf('/', { 'dt-guest': '1' })).toBe('/onboarding');
  });

  it('sends a fully onboarded guest hitting / to /dashboard', async () => {
    expect(await routeOf('/', { 'dt-guest': '1', 'dt-onboarded': '1' })).toBe('/dashboard');
  });

  it('sends an un-onboarded guest hitting /dashboard to /onboarding', async () => {
    expect(await routeOf('/dashboard', { 'dt-guest': '1' })).toBe('/onboarding');
  });

  it('lets an un-onboarded guest stay on /onboarding itself (no redirect loop)', async () => {
    expect(await routeOf('/onboarding', { 'dt-guest': '1' })).toBeNull();
  });
});

describe('proxy — anonymous, non-guest visitors', () => {
  it('passes / through so the public landing page renders', async () => {
    expect(await routeOf('/')).toBeNull();
  });

  it('still redirects an anonymous visitor on a protected page to /login', async () => {
    expect(await routeOf('/dashboard')).toBe('/login');
  });
});

describe('proxy — authenticated users', () => {
  it('redirects an authed user on /login to /dashboard', async () => {
    mockUser = { id: 'user-1' };
    expect(await routeOf('/login', { 'dt-onboarded': '1' })).toBe('/dashboard');
  });

  it('redirects an authed user on / to /dashboard', async () => {
    mockUser = { id: 'user-1' };
    expect(await routeOf('/', { 'dt-onboarded': '1' })).toBe('/dashboard');
  });

  it('sends an authed, un-onboarded user on /dashboard to /onboarding', async () => {
    mockUser = { id: 'user-1' };
    expect(await routeOf('/dashboard')).toBe('/onboarding');
  });

  it('lets an authed, onboarded user into the app without a consent redirect', async () => {
    // Paper consent only (vault ADR-007): consented_at is set by the
    // researcher and is never a routing condition.
    mockUser = { id: 'user-1' };
    expect(await routeOf('/dashboard', { 'dt-onboarded': '1' })).toBeNull();
  });

  it('treats /consent like any other page (the route no longer exists)', async () => {
    mockUser = { id: 'user-1' };
    expect(await routeOf('/consent')).toBe('/onboarding');
    expect(await routeOf('/consent', { 'dt-onboarded': '1' })).toBeNull();
  });
});
