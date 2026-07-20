/**
 * Shared guard for the AI API routes.
 *
 * These routes are usable in *guest* mode (no Supabase login) for personal /
 * single-user deployments. Instead of rejecting anonymous callers we rate-limit
 * them by client IP. Three layers protect a public deployment of the paid Gemini
 * key without a full auth backend:
 *
 *  1. **Access gate** — when ``APP_ACCESS_CODE`` is set, anonymous callers must
 *     send a matching ``x-access-code`` header (authenticated users bypass it).
 *  2. **Fail-closed default** — in *production*, anonymous access is denied unless
 *     it is explicitly opted into via ``APP_ACCESS_CODE`` or ``ALLOW_ANONYMOUS=true``.
 *     This prevents silently shipping an open, paid endpoint. Development is
 *     unaffected so local work needs no extra config.
 *  3. **Durable daily quota** — authenticated users are capped per JST day
 *     (per-route + global, see ``DAILY_QUOTAS``) against the Supabase
 *     ``ai_usage`` table, which survives restarts unlike the in-memory limiter.
 *     Guests are excluded by design: ``ai_usage.user_id`` FKs to profiles, so
 *     IP-keyed rows are impossible; guests stay behind layers 1–2 plus the
 *     in-memory limiter. The quota *check* is fail-closed — a Supabase outage
 *     503s authenticated AI calls rather than granting unmetered access
 *     (deliberate trade-off: no free pass on DB error). Charging happens via
 *     {@link recordAiUsage} only after a successful Gemini call, so failed
 *     requests never consume quota.
 *
 * The access gate is the primary control. IP-based rate limiting is best-effort
 * defense-in-depth (cost control): on Vercel ``x-real-ip`` is set by the platform
 * and is not client-spoofable, so it is preferred over ``x-forwarded-for`` (whose
 * left-most entry a client can forge).
 */

import { NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServerSupabase, getServerUser } from '@/lib/supabase-server';
import { DAILY_QUOTAS, GLOBAL_DAILY_QUOTA, type AiRouteName } from '@/lib/rate-limit';

/** Milliseconds offset of Asia/Tokyo from UTC (no DST). */
const JST_OFFSET_MS = 9 * 3_600_000;

/** Today's date in JST as YYYY-MM-DD — matches the SQL side's Asia/Tokyo day. */
function jstDateString(): string {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Seconds until the next JST midnight, for the 429 Retry-After header. */
function secondsUntilJstMidnight(): number {
  const jstNow = Date.now() + JST_OFFSET_MS;
  const msIntoDay = jstNow % 86_400_000;
  return Math.max(1, Math.ceil((86_400_000 - msIntoDay) / 1000));
}

/**
 * Per-process key used only to equalise the length of the two operands before a
 * constant-time compare, so the comparison never leaks the secret's length.
 */
const COMPARE_KEY = randomBytes(32);

/** Constant-time, constant-length string equality (no length side-channel). */
export function constantTimeEqual(a: string, b: string): boolean {
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

/**
 * Result of {@link guardAiRoute}: either a short-circuit response, or the
 * rate-limit identity plus the authenticated user id (null for guests).
 */
export type GuardResult =
  | { blocked: NextResponse }
  | { clientId: string; userId: string | null };

/**
 * Check the durable daily quota for an authenticated user against `ai_usage`.
 *
 * Fail-closed: a Supabase read error returns a 503 rather than a free pass.
 * The check-then-charge design is not atomic — concurrent requests arriving at
 * cap−1 can overshoot the cap by the request concurrency, which is acceptable
 * for cost control.
 */
async function checkDailyQuota(
  userId: string,
  route: AiRouteName | undefined,
): Promise<NextResponse | null> {
  let rows: Array<{ route: string; calls: number }>;
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('ai_usage')
      .select('route, calls')
      .eq('user_id', userId)
      .eq('usage_date', jstDateString());
    if (error) throw error;
    rows = data ?? [];
  } catch (err) {
    console.error('[api-guard] daily quota check failed:', err);
    return NextResponse.json(
      { error: 'Usage quota check failed. Please try again later.' },
      { status: 503 },
    );
  }

  const total = rows.reduce((sum, r) => sum + r.calls, 0);
  const routeCalls = route ? (rows.find((r) => r.route === route)?.calls ?? 0) : 0;
  if (total >= GLOBAL_DAILY_QUOTA || (route && routeCalls >= DAILY_QUOTAS[route])) {
    return NextResponse.json(
      { error: 'Daily AI usage limit reached. Resets at midnight JST.' },
      { status: 429, headers: { 'Retry-After': String(secondsUntilJstMidnight()) } },
    );
  }
  return null;
}

/**
 * Authorize an AI route request and return its rate-limit identity.
 *
 * Parameters
 * ----------
 * request : Request
 *     The incoming route-handler request.
 * route : AiRouteName, optional
 *     The calling route's quota bucket. When given and the caller is
 *     authenticated, the durable per-route + global daily quotas are enforced;
 *     when omitted only the global quota applies.
 *
 * Returns
 * -------
 * GuardResult
 *     ``{ blocked }`` with a 403/429/503 response when the caller is not
 *     permitted, otherwise ``{ clientId, userId }`` — clientId feeds the
 *     in-memory rate limiter; userId (null for guests) feeds
 *     {@link recordAiUsage} after a successful AI call.
 */
export async function guardAiRoute(
  request: Request,
  route?: AiRouteName,
): Promise<GuardResult> {
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

  if (user?.id) {
    const quotaBlocked = await checkDailyQuota(user.id, route);
    if (quotaBlocked) return { blocked: quotaBlocked };
  }

  return { clientId: clientIdFor(request, user?.id), userId: user?.id ?? null };
}

/**
 * Charge one successful AI call to the user's durable daily quota.
 *
 * Call *after* a successful Gemini response so failed requests never consume
 * quota. Best-effort by design: the LLM cost is already spent, so on any
 * failure (including missing `profiles` row for pre-repair accounts) this
 * logs and returns — an undercount is the right failure mode. No-op for
 * guests (null userId).
 *
 * Parameters
 * ----------
 * userId : string | null
 *     Authenticated user id from {@link guardAiRoute}, or null for guests.
 * route : AiRouteName
 *     Quota bucket to charge.
 * estTokens : number, optional
 *     Total token count from the SDK's usageMetadata, when available.
 */
export async function recordAiUsage(
  userId: string | null,
  route: AiRouteName,
  estTokens?: number,
): Promise<void> {
  if (!userId) return;
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.rpc('increment_ai_usage', {
      p_route: route,
      p_est_tokens: Math.max(0, Math.round(estTokens ?? 0)),
    });
    if (error) throw error;
  } catch (err) {
    console.error(`[api-guard] recordAiUsage(${route}) failed:`, err);
  }
}
