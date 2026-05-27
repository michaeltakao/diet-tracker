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
import { createServerSupabase } from '@/lib/supabase-server';

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
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('[auth/callback] Code exchange failed:', exchangeError.message);
        const loginUrl = new URL('/login', origin);
        loginUrl.searchParams.set('error', 'exchange_failed');
        return NextResponse.redirect(loginUrl);
      }

      // Success — redirect to `next` (default: dashboard)
      // Ensure `next` is a relative path to prevent open-redirect attacks
      const safePath = next.startsWith('/') ? next : '/';
      return NextResponse.redirect(new URL(safePath, origin));

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
