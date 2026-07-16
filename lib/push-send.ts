/**
 * Web Push send core (FTUE P0 #7, second half) — server-side, DI-based.
 *
 * Pure/injected so unit tests never touch the `web-push` module or the
 * network: app/api/push-send/route.ts binds `send` to webpush.sendNotification
 * and `removeSubscription` to an RLS-scoped delete.
 *
 * Payloads are built 100% server-side from NUDGE_TEMPLATES + translations —
 * clients only ever choose a NudgeKind and a Lang (push-phishing guard).
 */

import { NUDGE_TEMPLATES, type NudgeKind } from './notifications';
import { translations, type Lang } from './i18n';

export interface PushPayload {
  title: string;
  body: string;
  /** Client route the notification click should open. */
  url: string;
}

/** The subscription fields the sender needs (subset of push_subscriptions). */
export interface SubscriptionRow {
  endpoint: string;
  keys_auth: string;
  keys_p256dh: string;
}

/** Build the notification payload for a nudge kind, fully server-side. */
export function buildNudgePayload(kind: NudgeKind, lang: Lang): PushPayload {
  const template = NUDGE_TEMPLATES[kind];
  const t = translations[lang];
  return {
    title: t[template.titleKey],
    body: t[template.bodyKey],
    url: template.href,
  };
}

export interface PushSendDeps {
  /** Deliver one payload to one endpoint (webpush.sendNotification-shaped). */
  send: (subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  }, payload: string) => Promise<unknown>;
  /** Drop a dead subscription row (404/410 from the push service). */
  removeSubscription: (endpoint: string) => Promise<unknown>;
}

export interface PushSendResult {
  sent: number;
  /** Dead endpoints (404/410) removed from the table. */
  removed: number;
  failed: number;
}

/** Endpoint host only — never log full endpoints, keys, or payloads. */
function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return '<invalid-endpoint>';
  }
}

/**
 * Fan a payload out to every subscription. Never throws: per-endpoint failures
 * are counted, and 404/410 (subscription expired/gone) triggers cleanup so the
 * table self-heals. Cleanup failures are swallowed — the next send retries.
 */
export async function sendPushNotifications(
  deps: PushSendDeps,
  subs: readonly SubscriptionRow[],
  payload: PushPayload,
): Promise<PushSendResult> {
  const body = JSON.stringify(payload);
  const result: PushSendResult = { sent: 0, removed: 0, failed: 0 };

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await deps.send(
          {
            endpoint: sub.endpoint,
            keys: { auth: sub.keys_auth, p256dh: sub.keys_p256dh },
          },
          body,
        );
        result.sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          try {
            await deps.removeSubscription(sub.endpoint);
          } catch {
            // cleanup failure is non-fatal — the row stays until the next send
          }
          result.removed++;
          return;
        }
        result.failed++;
        console.error(
          `[push-send] delivery failed (host=${endpointHost(sub.endpoint)}, status=${statusCode ?? 'n/a'})`,
        );
      }
    }),
  );

  return result;
}
