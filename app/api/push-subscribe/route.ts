/**
 * POST   /api/push-subscribe — register this browser's push subscription
 * DELETE /api/push-subscribe?endpoint=… — remove it (settings "disable")
 *
 * Auth-only (401 — never 403, which would trigger httpClient's access-code
 * prompt). user_id always comes from the verified session, never the body.
 *
 * POST body: PushSubscription.toJSON() → { endpoint, keys: { auth, p256dh } }
 * The upsert uses the service-role client ON CONFLICT (endpoint): on a shared
 * device an account switch must rebind the endpoint row to the new user, and
 * RLS would block updating the previous owner's row.
 *
 * Endpoint validation is SSRF hygiene: the server later POSTs to this URL via
 * web-push, so only known push-service hosts are accepted (allowlist in
 * lib/push-endpoint.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, createServerSupabase, createServiceSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { isAllowedPushEndpoint } from '@/lib/push-endpoint';

const MAX_KEY_LENGTH = 512;

/** Fail-closed body validation. Returns null when anything is off. */
function parseSubscription(body: unknown): { endpoint: string; auth: string; p256dh: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: unknown };

  if (typeof endpoint !== 'string' || !isAllowedPushEndpoint(endpoint)) return null;

  if (typeof keys !== 'object' || keys === null) return null;
  const { auth, p256dh } = keys as { auth?: unknown; p256dh?: unknown };
  if (typeof auth !== 'string' || auth.length === 0 || auth.length > MAX_KEY_LENGTH) return null;
  if (typeof p256dh !== 'string' || p256dh.length === 0 || p256dh.length > MAX_KEY_LENGTH) return null;

  return { endpoint, auth, p256dh };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Row bloat guard: every unique endpoint is a new row, so cap churn.
  const limit = checkRateLimit(user.id, 'push-subscribe', { maxRequests: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // invalid JSON → body stays null → 400 below
  }
  const sub = parseSubscription(body);
  if (!sub) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 503 });
  }

  const svc = await createServiceSupabase();
  const { error } = await svc
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        keys_auth: sub.auth,
        keys_p256dh: sub.p256dh,
      },
      { onConflict: 'endpoint' },
    );

  if (error) {
    // Generic message only — never echo DB error internals to the client.
    console.error('[PUSH_SUBSCRIBE_ERROR]', error);
    return NextResponse.json({ error: 'Subscription failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  // RLS client: a user can only ever delete their own rows. Idempotent.
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[PUSH_UNSUBSCRIBE_ERROR]', error);
    return NextResponse.json({ error: 'Unsubscribe failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
