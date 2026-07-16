import { describe, it, expect, vi } from 'vitest';
import {
  buildNudgePayload,
  sendPushNotifications,
  type PushSendDeps,
  type SubscriptionRow,
} from '../push-send';
import { NUDGE_TEMPLATES } from '../notifications';
import { translations } from '../i18n';

function sub(endpoint: string): SubscriptionRow {
  return { endpoint, keys_auth: 'auth-key', keys_p256dh: 'p256dh-key' };
}

/** An error shaped like web-push's WebPushError. */
function pushError(statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(`push failed ${statusCode}`), { statusCode });
}

describe('buildNudgePayload', () => {
  it.each(['ja', 'en'] as const)(
    'builds streak-at-risk payload from templates + translations (%s)',
    (lang) => {
      const p = buildNudgePayload('streak-at-risk', lang);
      expect(p.title).toBe(translations[lang].nudgeStreakTitle);
      expect(p.body).toBe(translations[lang].nudgeStreakBody);
      expect(p.url).toBe(NUDGE_TEMPLATES['streak-at-risk'].href);
    },
  );

  it.each(['ja', 'en'] as const)(
    'builds decay payload from templates + translations (%s)',
    (lang) => {
      const p = buildNudgePayload('decay', lang);
      expect(p.title).toBe(translations[lang].nudgeDecayTitle);
      expect(p.body).toBe(translations[lang].nudgeDecayBody);
      expect(p.url).toBe(NUDGE_TEMPLATES.decay.href);
    },
  );
});

describe('sendPushNotifications', () => {
  const payload = { title: 'T', body: 'B', url: '/' };

  function deps(overrides: Partial<PushSendDeps> = {}): PushSendDeps & {
    send: ReturnType<typeof vi.fn>;
    removeSubscription: ReturnType<typeof vi.fn>;
  } {
    return {
      send: vi.fn().mockResolvedValue(undefined),
      removeSubscription: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } as PushSendDeps & {
      send: ReturnType<typeof vi.fn>;
      removeSubscription: ReturnType<typeof vi.fn>;
    };
  }

  it('sends the JSON payload to every subscription and counts successes', async () => {
    const d = deps();
    const subs = [sub('https://push.example/a'), sub('https://push.example/b')];

    const result = await sendPushNotifications(d, subs, payload);

    expect(result).toEqual({ sent: 2, removed: 0, failed: 0 });
    expect(d.send).toHaveBeenCalledTimes(2);
    expect(d.send).toHaveBeenCalledWith(
      {
        endpoint: 'https://push.example/a',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      },
      JSON.stringify(payload),
    );
    expect(d.removeSubscription).not.toHaveBeenCalled();
  });

  it.each([404, 410])('removes the subscription on a %d and counts it as removed', async (status) => {
    const d = deps({ send: vi.fn().mockRejectedValue(pushError(status)) });

    const result = await sendPushNotifications(d, [sub('https://push.example/dead')], payload);

    expect(result).toEqual({ sent: 0, removed: 1, failed: 0 });
    expect(d.removeSubscription).toHaveBeenCalledWith('https://push.example/dead');
  });

  it('counts a 500 as failed without removing the subscription', async () => {
    const d = deps({ send: vi.fn().mockRejectedValue(pushError(500)) });

    const result = await sendPushNotifications(d, [sub('https://push.example/flaky')], payload);

    expect(result).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect(d.removeSubscription).not.toHaveBeenCalled();
  });

  it('swallows removeSubscription rejections (row stays until next send)', async () => {
    const d = deps({
      send: vi.fn().mockRejectedValue(pushError(410)),
      removeSubscription: vi.fn().mockRejectedValue(new Error('db down')),
    });

    const result = await sendPushNotifications(d, [sub('https://push.example/dead')], payload);

    expect(result).toEqual({ sent: 0, removed: 1, failed: 0 });
  });

  it('returns zeros for an empty subscription list', async () => {
    const d = deps();
    const result = await sendPushNotifications(d, [], payload);
    expect(result).toEqual({ sent: 0, removed: 0, failed: 0 });
    expect(d.send).not.toHaveBeenCalled();
  });

  it('a mixed batch never fails fast: success + dead + flaky all counted', async () => {
    const d = deps({
      send: vi.fn().mockImplementation((s: { endpoint: string }) => {
        if (s.endpoint.endsWith('/dead')) return Promise.reject(pushError(410));
        if (s.endpoint.endsWith('/flaky')) return Promise.reject(pushError(500));
        return Promise.resolve(undefined);
      }),
    });
    const subs = [
      sub('https://push.example/ok'),
      sub('https://push.example/dead'),
      sub('https://push.example/flaky'),
    ];

    const result = await sendPushNotifications(d, subs, payload);

    expect(result).toEqual({ sent: 1, removed: 1, failed: 1 });
    expect(d.send).toHaveBeenCalledTimes(3);
    expect(d.removeSubscription).toHaveBeenCalledTimes(1);
  });
});
