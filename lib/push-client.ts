/**
 * Web Push browser-side helpers (FTUE P0 #7, second half).
 *
 * Subscribe/unsubscribe against /api/push-subscribe and the client-triggered
 * send-to-self flow against /api/push-send. Push is authenticated-users-only;
 * guests keep the in-app NudgeBanner. Everything here is defensive: push is a
 * progressive enhancement and must never break the dashboard.
 */

import { postJson, deleteJson } from './httpClient';
import { jstToday } from './streak';
import type { NudgeKind } from './notifications';
import type { Lang } from './i18n';

/** localStorage marker: JST day of the last self-send (courtesy dedupe only —
 * the server's push_send_log PK is the real "max 1/day" enforcement). */
export const PUSH_SENT_KEY = 'diet-tracker-push-sent';

/** Feature detect. False on plain iOS Safari (no Home-Screen install). */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/** Standard base64url → Uint8Array decode for the VAPID applicationServerKey. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe this browser to push and register the subscription server-side.
 * Returns true on success, false when unsupported/unconfigured/failed.
 * Caller must already hold Notification.permission === 'granted'.
 */
export async function subscribeToPush(): Promise<boolean> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey || !isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
    await postJson('/api/push-subscribe', subscription.toJSON());
    return true;
  } catch (err) {
    console.error('[push-client] subscribe failed:', err);
    return false;
  }
}

/**
 * Unsubscribe: server row first, then the local subscription. A failed local
 * unsubscribe self-heals — the next send gets 404/410 and drops the row.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    await deleteJson(
      `/api/push-subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
    );
    await subscription.unsubscribe();
    return true;
  } catch (err) {
    console.error('[push-client] unsubscribe failed:', err);
    return false;
  }
}

/** True when this browser currently holds a push subscription. */
export async function hasPushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
}

/**
 * Client-triggered send-to-self: when the dashboard decides a nudge, mirror it
 * as an OS notification (validates the full pipeline until a server cron
 * exists). All guards are best-effort; the server's push_send_log enforces
 * the real max-1/JST-day. Never throws — push must not break the dashboard.
 */
export async function maybeSendSelfPush(kind: NudgeKind, lang: Lang): Promise<void> {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return;

    let sentDay: string | null = null;
    try {
      sentDay = localStorage.getItem(PUSH_SENT_KEY);
    } catch {
      // storage unavailable → rely on the server-side dedupe
    }
    if (sentDay === jstToday()) return;

    if (!(await hasPushSubscription())) return;

    const res = await postJson<{ sent: boolean; reason?: string }>(
      '/api/push-send',
      { kind, lang },
    );
    if (res.sent || res.reason === 'already-sent-today') {
      try {
        localStorage.setItem(PUSH_SENT_KEY, jstToday());
      } catch {
        // marker is courtesy only
      }
    }
  } catch {
    // never surface push failures on the dashboard
  }
}
