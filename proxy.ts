/**
 * Next.js 16 Proxy (replaces middleware.ts from Next.js ≤15).
 *
 * Two responsibilities:
 * 1. Session refresh — update Supabase auth cookies on every request so that
 *    Server Components and Route Handlers always see a fresh session.
 * 2. Auth guard — redirect unauthenticated users to /login when Supabase is
 *    fully configured.
 *
 * Guest mode: if NEXT_PUBLIC_SUPABASE_URL contains "placeholder" or "xxxx"
 * (i.e., the developer hasn't set up Supabase yet), all auth checks are
 * bypassed and the app runs in localStorage-only guest mode. With Supabase
 * configured, a user can still opt into guest mode per-device via the
 * dt-guest cookie (set by the login page's "Continue without an account"
 * link); the auth guard then passes unauthenticated page requests through.
 *
 * See: docs/decisions/ADR-007-dual-write.md
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Returns true when the environment has real Supabase credentials.
 * NOTE: cannot import from lib/ — proxy runs at Edge before module resolution.
 */
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const hasUrl = url.length > 0 && !url.includes('placeholder') && !url.includes('xxxx');
  const hasKey = key.length > 0 && !key.includes('placeholder');
  return hasUrl && hasKey;
}

export async function proxy(request: NextRequest) {
  // ── Guest mode: pass through ───────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  // ── Build mutable response to carry refreshed cookies ─────────────────────
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // ── Supabase server client (proxy context) ─────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, responseHeaders) {
          // Mutate request cookies so Server Components see the new values
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Rebuild response so we can write Set-Cookie headers
          response = NextResponse.next({ request });
          // Write cookies to the response
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Write anti-caching headers required by @supabase/ssr
          Object.entries(responseHeaders ?? {}).forEach(([k, v]) =>
            response.headers.set(k, v),
          );
        },
      },
    },
  );

  // ── Refresh session (IMPORTANT: must call before sending response) ─────────
  // getUser() validates the JWT with the Auth server and refreshes the session
  // if the access token has expired. This is the canonical proxy pattern.
  const { data: { user } } = await supabase.auth.getUser();

  // ── Auth guard ────────────────────────────────────────────────────────────
  const pathname = request.nextUrl.pathname;
  const isLoginPage      = pathname === '/login';
  const isAuthRoute      = pathname.startsWith('/auth/');
  const isConsentPage    = pathname === '/consent';
  const isApiRoute       = pathname.startsWith('/api/');
  const isOnboardingPage = pathname === '/onboarding';

  // First visit → /onboarding (FTUE D4). Page routes only. For authed users
  // this fires AFTER the consent check below (consent always comes first).
  // The dt-onboarded cookie is per-device: a returning user on a new device
  // is re-prompted once (the wizard prefills from their profile and is
  // skippable in one tap). With placeholder Supabase env this proxy returns
  // at the top, so local guest dev stays ungated; production is configured.
  const needsOnboarding =
    !isOnboardingPage && !isConsentPage && !isApiRoute && !isAuthRoute && !isLoginPage &&
    request.cookies.get('dt-onboarded')?.value !== '1';
  const onboardingRedirect = () => {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = '/onboarding';
    return NextResponse.redirect(onboardingUrl);
  };

  // Unauthenticated → /login
  // Exception: explicit guest opt-in (dt-guest cookie, set by the login page's
  // "Continue without an account" link). Guests run localStorage-only; AI
  // routes still enforce their own gate in lib/api-guard.ts.
  const isGuest = request.cookies.get('dt-guest')?.value === '1';
  if (!user && isGuest && !isLoginPage) {
    if (needsOnboarding) return onboardingRedirect();
    return response;
  }
  if (!user && !isLoginPage && !isAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preserve the original destination so we can redirect back after login
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated + already on /login → dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Authenticated but not yet consented → /consent
  // Skip redirect for the consent page itself, API routes, and auth routes.
  if (user && !isConsentPage && !isApiRoute && !isAuthRoute && !isLoginPage) {
    const profile = await supabase
      .from('profiles')
      .select('consented_at')
      .eq('id', user.id)
      .maybeSingle();
    // Fail closed: a missing row (trigger failure, pre-001 user) or a query
    // error must land on /consent, never inside the app unconsented.
    if (!profile.data || profile.data.consented_at === null) {
      const consentUrl = request.nextUrl.clone();
      consentUrl.pathname = '/consent';
      return NextResponse.redirect(consentUrl);
    }
  }

  // Authed onboarding gate — after consent so /consent always wins.
  if (user && needsOnboarding) {
    return onboardingRedirect();
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * Run proxy on all routes EXCEPT:
     * - Next.js static assets: _next/static, _next/image
     * - API routes: /api/* (these handle auth themselves via getServerUser())
     * - Static files with extensions: .ico, .svg, .png, .jpg, .webp, etc.
     * - PWA files: manifest, sw
     *
     * The negative lookahead (?!...) excludes those paths.
     */
    '/((?!_next/static|_next/image|api|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)',
  ],
};
