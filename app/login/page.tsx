'use client';

/**
 * Login page.
 *
 * Three auth paths:
 * 1. Google OAuth (primary — one-click, no password)
 * 2. Email magic link (secondary — passwordless OTP)
 * 3. Guest mode (skip auth — app runs in localStorage-only mode)
 *
 * After successful OAuth, Supabase redirects to /auth/callback which
 * exchanges the code for a session and redirects to the dashboard.
 *
 * After successful magic link, the user receives an email with a link
 * that also goes through /auth/callback.
 *
 * URL params:
 *   ?next=<path>     — redirect here after login (injected by proxy.ts)
 *   ?error=<code>    — error code from /auth/callback
 *   ?message=<text>  — human-readable error detail
 */

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, LogIn, Leaf } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';

// ── Google icon (inline SVG — avoids next/image in auth context) ──────────────

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ── Inner component (uses useSearchParams — must be in Suspense) ──────────────

function LoginPageInner() {
  const { signInWithGoogle, signInWithEmail, isAuthenticated } = useProfile();
  const searchParams = useSearchParams();

  const nextPath   = searchParams.get('next') ?? '/';
  const errorCode  = searchParams.get('error');
  const errorMsg   = searchParams.get('message');

  const [email,       setEmail]       = useState('');
  const [emailSent,   setEmailSent]   = useState(false);
  const [emailError,  setEmailError]  = useState<string | null>(null);
  const [loadingOAuth, setLoadingOAuth] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  // Build human-readable error text from URL params
  const urlError = errorCode
    ? errorMsg ?? getErrorLabel(errorCode)
    : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleGoogle() {
    setLoadingOAuth(true);
    try {
      await signInWithGoogle();
      // signInWithGoogle triggers a full-page redirect; execution stops here
    } catch {
      setLoadingOAuth(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setEmailError(null);
    setLoadingEmail(true);

    const { error } = await signInWithEmail(email.trim());
    setLoadingEmail(false);

    if (error) {
      setEmailError(error);
    } else {
      setEmailSent(true);
    }
  }

  // ── Already authenticated ─────────────────────────────────────────────────

  if (isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-slate-500">Redirecting…</p>
      </div>
    );
  }

  // ── Email sent confirmation ────────────────────────────────────────────────

  if (emailSent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Mail className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Check your inbox
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            We sent a magic link to <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>.<br />
            Click the link to sign in.
          </p>
        </div>
        <button
          onClick={() => { setEmailSent(false); setEmail(''); }}
          className="text-sm text-green-600 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  // ── Main login form ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 gap-8">

      {/* Brand */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <Leaf className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Diet Tracker
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
          AI-powered nutrition & fitness tracking.
          Sign in to sync your data across devices.
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-card)' }}
      >

        {/* URL error (from /auth/callback redirects) */}
        {urlError && (
          <div className="rounded-xl px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {urlError}
          </div>
        )}

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={loadingOAuth}
          className="
            w-full flex items-center justify-center gap-3 rounded-xl
            py-3 px-4 border border-slate-200 dark:border-slate-700
            text-sm font-medium text-slate-700 dark:text-slate-200
            bg-white dark:bg-slate-800
            hover:bg-slate-50 dark:hover:bg-slate-700
            active:scale-[0.98] transition-all
            disabled:opacity-50 disabled:pointer-events-none
          "
        >
          {loadingOAuth
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <GoogleIcon />
          }
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Email magic link */}
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-email"
              className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="
                w-full rounded-xl px-4 py-2.5 text-sm
                border border-slate-200 dark:border-slate-700
                bg-slate-50 dark:bg-slate-900
                text-slate-800 dark:text-slate-100
                placeholder:text-slate-400
                focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500
              "
            />
          </div>

          {emailError && (
            <p className="text-xs text-red-500">{emailError}</p>
          )}

          <button
            type="submit"
            disabled={loadingEmail || !email.trim()}
            className="
              w-full flex items-center justify-center gap-2 rounded-xl
              py-3 px-4
              text-sm font-medium text-white
              bg-green-500 hover:bg-green-600 active:bg-green-700
              active:scale-[0.98] transition-all
              disabled:opacity-50 disabled:pointer-events-none
            "
          >
            {loadingEmail
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <LogIn className="w-4 h-4" />
            }
            Send magic link
          </button>
        </form>
      </div>

      {/* Guest mode */}
      <Link
        href={nextPath.startsWith('/') ? nextPath : '/'}
        className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        Continue without an account →
      </Link>

      {/* Privacy note */}
      <p className="text-xs text-slate-400 dark:text-slate-600 text-center max-w-xs">
        By signing in, you agree to store your health data in Supabase.
        Guest mode keeps all data on this device only.
      </p>
    </div>
  );
}

// ── Error label helper ────────────────────────────────────────────────────────

function getErrorLabel(code: string): string {
  switch (code) {
    case 'auth_failed':      return 'Authentication failed. Please try again.';
    case 'oauth_error':      return 'OAuth sign-in was cancelled or failed.';
    case 'exchange_failed':  return 'Sign-in link expired. Please request a new one.';
    case 'missing_code':     return 'Invalid sign-in link. Please request a new one.';
    case 'server_error':     return 'Server error. Please try again later.';
    default:                 return 'Sign-in failed. Please try again.';
  }
}

// ── Page export (Suspense required for useSearchParams) ───────────────────────

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin text-green-500" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
