/**
 * OAuth / Magic Link callback handler.
 *
 * Supabase uses PKCE flow: after the user authenticates, Supabase redirects to
 * this route with a `code` query parameter. We exchange it for a session and
 * set the auth cookies, then redirect to the app.
 *
 * Route: GET /auth/callback?code=<pkce_code>[&next=<redirect_path>]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';

/**
 * Resolve a post-login `next` redirect target against `origin`, rejecting
 * anything that would leave the app's own origin.
 *
 * Guards against open redirects, including protocol-relative paths like
 * `//evil.com` — browsers treat a leading `//` as scheme-relative and will
 * follow it off-site even though `next.startsWith('/')` is true for it.
 *
 * @param rawNext - The `next` query param as received (untrusted).
 * @param origin - The app's own origin, e.g. `https://example.com`.
 * @returns A same-origin path (+ search + hash), or `/` if `rawNext` was
 *   unparseable, cross-origin, or protocol-relative.
 */
export function resolveSafeNext(rawNext: string, origin: string): string {
  try {
    const resolved = new URL(rawNext, origin);
    if (resolved.origin === origin && !resolved.pathname.startsWith('//')) {
      return resolved.pathname + resolved.search + resolved.hash;
    }
  } catch {
    // Unparseable `next` — fall through to home.
  }
  return '/';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // ── OAuth error from provider ──────────────────────────────────────────────
  if (error) {
    console.error('[auth/callback] OAuth error:', error, errorDescription);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'oauth_error');
    loginUrl.searchParams.set('message', errorDescription ?? error);
    return NextResponse.redirect(loginUrl);
  }

  // ── PKCE code exchange ─────────────────────────────────────────────────────
  if (code) {
    try {
      const supabase = await createServerSupabase();
      const { data: exchanged, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('[auth/callback] Code exchange failed:', exchangeError.message);
        const loginUrl = new URL('/login', origin);
        loginUrl.searchParams.set('error', 'exchange_failed');
        return NextResponse.redirect(loginUrl);
      }

      // Best-effort: ensure the profiles row exists. The on_auth_user_created
      // trigger normally creates it, but if it ever failed (or the user
      // predates 001) the row is missing and RLS has no INSERT policy for the
      // anon client — repair via service role. Any failure here must NOT
      // break login: the proxy's fail-closed consent guard is the backstop.
      try {
        const user = exchanged?.user;
        if (user) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!profileRow && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const svc = await createServiceSupabase();
            // Mirrors handle_new_user() (001:53-58); ignoreDuplicates never
            // clobbers a row created concurrently.
            const { error: upsertError } = await svc.from('profiles').upsert(
              {
                id: user.id,
                display_name:
                  (user.user_metadata?.full_name as string | undefined) ??
                  user.email?.split('@')[0] ??
                  null,
                avatar_url:
                  (user.user_metadata?.avatar_url as string | undefined) ?? null,
              },
              { onConflict: 'id', ignoreDuplicates: true },
            );
            if (upsertError) {
              console.error('[auth/callback] profiles ensure-row failed:', upsertError);
            }
          }
        }
      } catch (ensureErr) {
        console.error('[auth/callback] profiles ensure-row failed:', ensureErr);
      }

      // Success — redirect to `next` (default: dashboard)
      // Resolve `next` against `origin` and require it to stay same-origin,
      // rejecting protocol-relative paths (`//evil.com`) that `startsWith('/')`
      // alone would accept — browsers treat a leading `//` as scheme-relative
      // and follow it off-site.
      return NextResponse.redirect(new URL(resolveSafeNext(next, origin), origin));

    } catch (err) {
      console.error('[auth/callback] Unexpected error:', err);
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'server_error');
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── No code — bad request ──────────────────────────────────────────────────
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('error', 'missing_code');
  return NextResponse.redirect(loginUrl);
}
