/**
 * Shared guard for the AI API routes.
 *
 * These routes are usable in *guest* mode (no Supabase login) for personal /
 * single-user deployments. Instead of rejecting anonymous callers we rate-limit
 * them by client IP. Two layers protect a public deployment of the paid Gemini
 * key without a full auth backend:
 *
 *  1. **Access gate** — when ``APP_ACCESS_CODE`` is set, anonymous callers must
 *     send a matching ``x-access-code`` header (authenticated users bypass it).
 *  2. **Fail-closed default** — in *production*, anonymous access is denied unless
 *     it is explicitly opted into via ``APP_ACCESS_CODE`` or ``ALLOW_ANONYMOUS=true``.
 *     This prevents silently shipping an open, paid endpoint. Development is
 *     unaffected so local work needs no extra config.
 *
 * The access gate is the primary control. IP-based rate limiting is best-effort
 * defense-in-depth (cost control): on Vercel ``x-real-ip`` is set by the platform
 * and is not client-spoofable, so it is preferred over ``x-forwarded-for`` (whose
 * left-most entry a client can forge).
 */

import { NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getServerUser } from '@/lib/supabase-server';

/**
 * Per-process key used only to equalise the length of the two operands before a
 * constant-time compare, so the comparison never leaks the secret's length.
 */
const COMPARE_KEY = randomBytes(32);

/** Constant-time, constant-length string equality (no length side-channel). */
function constantTimeEqual(a: string, b: string): boolean {
  const da = createHmac('sha256', COMPARE_KEY).update(a).digest();
  const db = createHmac('sha256', COMPARE_KEY).update(b).digest();
  return timingSafeEqual(da, db); // both digests are always 32 bytes
}

/** Resolve the rate-limit key, preferring the platform-trusted client IP. */
function clientIdFor(request: Request, userId: string | undefined): string {
  return (
    userId
    ?? request.headers.get('x-real-ip')?.trim()
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'guest'
  );
}

/** Result of {@link guardAiRoute}: either a short-circuit response or a clientId. */
export type GuardResult = { blocked: NextResponse } | { clientId: string };

/**
 * Authorize an AI route request and return its rate-limit identity.
 *
 * Parameters
 * ----------
 * request : Request
 *     The incoming route-handler request.
 *
 * Returns
 * -------
 * GuardResult
 *     ``{ blocked }`` with a 403/503 response when the caller is not permitted,
 *     otherwise ``{ clientId }`` to feed into the rate limiter.
 */
export async function guardAiRoute(request: Request): Promise<GuardResult> {
  const user = await getServerUser();
  const authenticated = Boolean(user?.id);

  const required = process.env.APP_ACCESS_CODE;

  if (required) {
    // Gate enabled: authenticated users pass; anonymous callers need the code.
    if (!authenticated) {
      const provided = request.headers.get('x-access-code') ?? '';
      if (!constantTimeEqual(provided, required)) {
        return { blocked: NextResponse.json({ error: 'Access code required' }, { status: 403 }) };
      }
    }
  } else if (!authenticated) {
    // No gate configured and the caller is anonymous. Fail closed in production
    // unless anonymous access was explicitly enabled.
    const allowAnonymous = process.env.ALLOW_ANONYMOUS === 'true';
    if (process.env.NODE_ENV === 'production' && !allowAnonymous) {
      return {
        blocked: NextResponse.json(
          { error: 'Anonymous access is disabled. Set APP_ACCESS_CODE or ALLOW_ANONYMOUS=true.' },
          { status: 503 },
        ),
      };
    }
  }

  return { clientId: clientIdFor(request, user?.id) };
}
