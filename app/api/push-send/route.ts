/**
 * POST /api/push-send — send the daily nudge to the caller's own devices.
 *
 * Client-triggered send-to-self (validates the pipeline end-to-end until a
 * server-side cron exists). The client controls exactly two enums (kind,
 * lang); the notification payload is built 100% server-side from static
 * templates — push-phishing guard.
 *
 * Request body: { kind: 'streak-at-risk' | 'decay', lang: 'ja' | 'en' }
 * Response 200: { sent: boolean, reason?: 'already-sent-today',
 *                 counts?: { sent, removed, failed } }
 * 400 — invalid kind/lang
 * 401 — not authenticated (never 403 — httpClient prompts on 403)
 * 429 — per-minute rate limit
 * 503 — VAPID env not configured (fail-closed, no key material in message)
 *
 * "Max 1 nudge per JST day" is enforced atomically by push_send_log's
 * PRIMARY KEY (user_id, sent_date) — insert first, send only on success.
 */

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getServerUser, createServerSupabase } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildNudgePayload, sendPushNotifications } from '@/lib/push-send';
import { jstToday } from '@/lib/streak';
import type { NudgeKind } from '@/lib/notifications';
import type { Lang } from '@/lib/i18n';

const KINDS: readonly NudgeKind[] = ['streak-at-risk', 'decay'];
const LANGS: readonly Lang[] = ['ja', 'en'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ① auth
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ② env fail-closed — never leak which variable is missing
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 503 });
  }

  // ③ enum-validate the only two client-controlled fields
  let kind: NudgeKind | undefined;
  let lang: Lang | undefined;
  try {
    const body = await req.json();
    if (KINDS.includes(body?.kind)) kind = body.kind;
    if (LANGS.includes(body?.lang)) lang = body.lang;
  } catch {
    // invalid JSON → kind/lang stay undefined → 400 below
  }
  if (!kind || !lang) {
    return NextResponse.json({ error: 'Invalid kind or lang' }, { status: 400 });
  }

  // ④ per-minute rate limit (in-memory; the daily dedupe below is durable)
  const limit = checkRateLimit(user.id, 'push-send', { maxRequests: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const supabase = await createServerSupabase();

  // ⑤ atomic daily dedupe: PK (user_id, sent_date) — 23505 means already sent
  const { error: logError } = await supabase
    .from('push_send_log')
    .insert({ user_id: user.id, sent_date: jstToday(), kind });

  if (logError) {
    if (logError.code === '23505') {
      return NextResponse.json({ sent: false, reason: 'already-sent-today' });
    }
    console.error('[PUSH_SEND_LOG_ERROR]', logError);
    return NextResponse.json({ error: 'Send failed. Please try again.' }, { status: 500 });
  }

  // ⑥ RLS select — a user can only ever reach their own subscriptions
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_auth, keys_p256dh')
    .eq('user_id', user.id);

  if (subsError) {
    console.error('[PUSH_SEND_SUBS_ERROR]', subsError);
    return NextResponse.json({ error: 'Send failed. Please try again.' }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: false, reason: 'no-subscriptions' });
  }

  // ⑦ lazy VAPID setup (module scope would crash builds without env)
  webpush.setVapidDetails(subject, publicKey, privateKey);

  // ⑧ fan out; 404/410 endpoints are dropped via an RLS-scoped delete
  const counts = await sendPushNotifications(
    {
      send: (sub, payload) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
        ),
      removeSubscription: async (endpoint) =>
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', endpoint),
    },
    subs,
    buildNudgePayload(kind, lang),
  );

  // ⑨ report counts (endpoint hosts only ever hit server logs, never clients)
  return NextResponse.json({ sent: counts.sent > 0, counts });
}
