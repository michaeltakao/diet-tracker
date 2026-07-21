/**
 * POST /api/feedback — free-text beta feedback / bug report (FTUE roadmap
 * §12 beta-gate feedback channel, Workstream 6).
 *
 * Auth is OPTIONAL by product design: guest (unauthenticated) bug reports
 * are explicitly allowed, since a broken flow is exactly the moment a guest
 * is most likely to want to report something and least likely to have
 * signed up first. user_id is null for guest submissions.
 *
 * Always uses the service-role client (never the RLS client): an
 * authenticated caller's request still goes through service-role because a
 * guest caller's auth.uid() is NULL and would fail the owner-only RLS
 * WITH CHECK on beta_feedback regardless — one code path, not two. user_id
 * always comes from the verified session when present, never from the
 * request body (spoofing a different user's feedback is not possible).
 *
 * Request body: { message: string (1-2000 chars), pagePath?: string }
 * Response (200): { ok: true }
 * 400 — message missing/empty/too long
 * 429 — rate limited (IP-keyed for guests, user-keyed for authenticated)
 * 503 — service role not configured (fail-closed, matches push-subscribe)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, createServiceSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_PATH_LENGTH = 200;

function parseBody(body: unknown): { message: string; pagePath: string | null } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { message, pagePath } = body as { message?: unknown; pagePath?: unknown };
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LENGTH) return null;
  const cleanPath =
    typeof pagePath === 'string' && pagePath.length > 0 && pagePath.length <= MAX_PAGE_PATH_LENGTH
      ? pagePath
      : null;
  return { message: trimmed, pagePath: cleanPath };
}

/** Best-effort client IP (Vercel-set, not client-spoofable) for guest rate limiting. */
function clientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getServerUser();

  const rateLimitKey = user ? user.id : `guest:${clientIp(req)}`;
  const limit = checkRateLimit(rateLimitKey, 'feedback', { maxRequests: 10, windowMs: 3_600_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // invalid JSON → body stays null → 400 below
  }
  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid feedback message' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Feedback is not configured' }, { status: 503 });
  }

  const svc = await createServiceSupabase();
  const { error } = await svc.from('beta_feedback').insert({
    user_id: user?.id ?? null,
    message: parsed.message,
    page_path: parsed.pagePath,
  });

  if (error) {
    console.error('[FEEDBACK_INSERT_ERROR]', error);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
