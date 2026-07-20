/**
 * GET /api/push-send-cron — server-initiated nudge fan-out (FTUE P0 #7,
 * server-side back half).
 *
 * Invoked by Vercel Cron (vercel.json), which calls Route Handlers as GET
 * with `Authorization: Bearer ${CRON_SECRET}`. This is the send path that
 * actually reaches a user who never opens the app — the client-triggered
 * POST /api/push-send that shipped 2026-07-17 was explicitly a stopgap to
 * validate the pipeline end-to-end until this existed.
 *
 * Auth: CRON_SECRET compared with constantTimeEqual (lib/api-guard.ts).
 *   - CRON_SECRET unset       → 503 (fail closed, never silently accept)
 *   - Authorization mismatch  → 401
 * VAPID env fail-closed → 503, identical check to app/api/push-send/route.ts.
 *
 * Iterates every user with a push_subscriptions row (bounded by subscriber
 * count, not total user count), skips anyone already in today's
 * push_send_log, otherwise reconstructs their NudgeInput from batched
 * per-table queries (see lib/nudge-fanout.ts) and reuses the exact
 * dedupe-insert → send → rollback-on-total-failure flow from the
 * client-triggered route, per user.
 *
 * Response is aggregate counts only — never per-user detail (privacy,
 * matches the existing route's "endpoint hosts only in logs" discipline).
 */

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServiceSupabase } from '@/lib/supabase-server';
import { constantTimeEqual } from '@/lib/api-guard';
import { buildNudgePayload, sendPushNotifications } from '@/lib/push-send';
import { buildNudgeInputFor, groupActivityDaysByUser, type UserLogDates } from '@/lib/nudge-fanout';
import { decideNudge } from '@/lib/notifications';
import { jstToday } from '@/lib/streak';

const JST_OFFSET_MS = 9 * 3_600_000;

/** Current hour-of-day (0–23) in JST — matches lib/notifications.ts jstHour(). */
function jstHour(now: number = Date.now()): number {
  return new Date(now + JST_OFFSET_MS).getUTCHours();
}

/** Log tables unconditionally counted as "any-log" activity (see streak.ts activityDaysFrom). */
const UNCONDITIONAL_LOG_TABLES = [
  'food_logs',
  'workout_logs',
  'weight_logs',
  'vital_logs',
  'symptom_logs',
] as const;

interface LogDateRow {
  user_id: string;
  logged_date: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ① auth — fail closed if CRON_SECRET itself is unset
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!constantTimeEqual(provided, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ② VAPID env fail-closed — identical check to app/api/push-send/route.ts
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 503 });
  }

  const supabase = await createServiceSupabase();

  // ③ subscribers = the bound for every subsequent query (not total user count)
  const { data: subRows, error: subError } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, keys_auth, keys_p256dh');
  if (subError) {
    console.error('[PUSH_CRON_SUBS_ERROR]', subError);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
  if (!subRows || subRows.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0, alreadySentToday: 0, errors: 0 });
  }
  const subscriberIds = [...new Set(subRows.map((r) => r.user_id))];

  const today = jstToday();
  const hour = jstHour();

  // ④ batched fetch: one query per table, bounded to subscriber ids
  const [logsByTable, waterRes, profilesRes, sentTodayRes] = await Promise.all([
    Promise.all(
      UNCONDITIONAL_LOG_TABLES.map((table) =>
        supabase
          .from(table)
          .select('user_id, logged_date')
          .in('user_id', subscriberIds),
      ),
    ),
    supabase
      .from('water_logs')
      .select('user_id, logged_date, total_ml')
      .in('user_id', subscriberIds)
      .gt('total_ml', 0),
    supabase
      .from('profiles')
      .select('id, lang')
      .in('id', subscriberIds),
    supabase
      .from('push_send_log')
      .select('user_id')
      .eq('sent_date', today)
      .in('user_id', subscriberIds),
  ]);

  for (const [i, res] of logsByTable.entries()) {
    if (res.error) {
      console.error(`[PUSH_CRON_LOGS_ERROR] table=${UNCONDITIONAL_LOG_TABLES[i]}`, res.error);
      return NextResponse.json({ error: 'Send failed' }, { status: 500 });
    }
  }
  if (waterRes.error) {
    console.error('[PUSH_CRON_WATER_ERROR]', waterRes.error);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
  if (profilesRes.error) {
    console.error('[PUSH_CRON_PROFILES_ERROR]', profilesRes.error);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
  if (sentTodayRes.error) {
    console.error('[PUSH_CRON_SENTLOG_ERROR]', sentTodayRes.error);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }

  const allDateRows: LogDateRow[] = logsByTable.flatMap((res) => res.data ?? []);
  for (const w of waterRes.data ?? []) {
    allDateRows.push({ user_id: w.user_id, logged_date: w.logged_date });
  }
  const activityByUser = groupActivityDaysByUser(allDateRows);

  const langByUser = new Map<string, 'ja' | 'en'>();
  for (const p of profilesRes.data ?? []) {
    langByUser.set(p.id, p.lang === 'en' ? 'en' : 'ja');
  }

  const alreadySentToday = new Set((sentTodayRes.data ?? []).map((r) => r.user_id));

  // ⑤ lazy VAPID setup, once, before the loop (global config, not per-user)
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const subsByUser = new Map<string, typeof subRows>();
  for (const s of subRows) {
    const list = subsByUser.get(s.user_id) ?? [];
    list.push(s);
    subsByUser.set(s.user_id, list);
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let alreadySentCount = 0;

  for (const userId of subscriberIds) {
    if (alreadySentToday.has(userId)) {
      alreadySentCount++;
      continue;
    }

    const user: UserLogDates = {
      userId,
      lang: langByUser.get(userId) ?? 'ja',
      activityDays: activityByUser.get(userId) ?? new Set<string>(),
    };
    const decision = decideNudge(buildNudgeInputFor(user, today, hour));
    if (decision.kind === 'none') {
      skipped++;
      continue;
    }

    // dedupe insert-first — PK (user_id, sent_date), matches the client route
    const { error: logError } = await supabase
      .from('push_send_log')
      .insert({ user_id: userId, sent_date: today, kind: decision.kind });
    if (logError) {
      if (logError.code === '23505') {
        alreadySentCount++;
        continue;
      }
      console.error('[PUSH_CRON_LOG_ERROR]', logError);
      errors++;
      continue;
    }

    const userSubs = subsByUser.get(userId) ?? [];
    const counts = await sendPushNotifications(
      {
        send: (sub, payload) =>
          webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload),
        removeSubscription: async (endpoint) =>
          await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint),
      },
      userSubs,
      buildNudgePayload(decision.kind, user.lang),
    );

    if (counts.sent === 0) {
      // nothing delivered — free the day again, same trade-off as the client route.
      const { error: rollbackError } = await supabase
        .from('push_send_log')
        .delete()
        .eq('user_id', userId)
        .eq('sent_date', today);
      if (rollbackError) {
        console.error('[PUSH_CRON_ROLLBACK_ERROR]', rollbackError);
      }
      errors++;
      continue;
    }
    sent++;
  }

  return NextResponse.json({
    processed: subscriberIds.length,
    sent,
    skipped,
    alreadySentToday: alreadySentCount,
    errors,
  });
}
