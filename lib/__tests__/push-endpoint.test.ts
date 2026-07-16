import { describe, it, expect } from 'vitest';
import { isAllowedPushEndpoint, MAX_ENDPOINT_LENGTH } from '../push-endpoint';

describe('isAllowedPushEndpoint', () => {
  it.each([
    // every real browser push service
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/xyz',
    'https://autopush.prod.mozaws.net/wpush/v2/xyz',
    'https://db5p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/QOkzoXVWmYzYbwHAuXwAxA',
  ])('accepts the known push services (%s)', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ['arbitrary public host (SSRF beacon)', 'https://attacker.example.com/collect'],
    ['plain http on an allowed host', 'http://fcm.googleapis.com/fcm/send/x'],
    ['suffix-spoof: evil-googleapis.com', 'https://evil-googleapis.com/x'],
    ['suffix-spoof: googleapis.com.evil.com', 'https://googleapis.com.evil.com/x'],
    ['localhost', 'https://localhost/x'],
    ['loopback IP', 'https://127.0.0.1/x'],
    ['decimal-encoded loopback', 'https://2130706433/x'],
    ['hex-encoded loopback', 'https://0x7f000001/x'],
    ['short-form loopback', 'https://127.1/x'],
    ['cloud metadata IP', 'https://169.254.169.254/latest/meta-data'],
    ['private range', 'https://10.0.0.5/x'],
    ['IPv6 loopback literal', 'https://[::1]/x'],
    ['IPv6 ULA literal', 'https://[fd00::1]/x'],
    ['not a URL', 'fcm.googleapis.com/no-scheme'],
    ['empty string', ''],
  ])('rejects %s', (_label, endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });

  it('rejects endpoints over the length cap even on an allowed host', () => {
    const long = `https://fcm.googleapis.com/fcm/send/${'a'.repeat(MAX_ENDPOINT_LENGTH)}`;
    expect(long.length).toBeGreaterThan(MAX_ENDPOINT_LENGTH);
    expect(isAllowedPushEndpoint(long)).toBe(false);
  });

  it('is case-insensitive on the host, not the path', () => {
    expect(isAllowedPushEndpoint('https://FCM.GOOGLEAPIS.COM/fcm/send/CaseInPath')).toBe(true);
  });
});
