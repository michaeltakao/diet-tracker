/**
 * Push-endpoint validation (server-side, shared by /api/push-subscribe).
 *
 * ALLOWLIST, not blocklist: the server later POSTs to this URL via web-push,
 * so only the real browser push services are accepted (council review
 * 2026-07-17 finding #1 — a blocklist accepted any public host = blind SSRF
 * beacon, and subscribe-time IP checks could be defeated by DNS rebinding at
 * send time; an allowlist closes both). Every browser's PushManager hands out
 * endpoints on one of these domains — anything else is not a real
 * subscription.
 */

/** Known Web Push service hosts (matched exactly or as a subdomain suffix). */
const ALLOWED_PUSH_HOST_SUFFIXES = [
  'googleapis.com',            // Chrome / Chromium (FCM)
  'push.services.mozilla.com', // Firefox (autopush)
  'mozaws.net',                // Firefox (autopush infra)
  'notify.windows.com',        // Edge (WNS)
  'push.apple.com',            // Safari (APNs web push)
] as const;

export const MAX_ENDPOINT_LENGTH = 1024;

/**
 * True when `endpoint` is an https URL on a known push-service host and
 * within the length cap. Fail-closed: anything unparseable is rejected.
 */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) return false;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;

  // WHATWG URL normalizes IP tricks (decimal/hex/short loopback) into plain
  // dotted-quad hostnames before this check — and no IP literal, private or
  // public, can ever match a domain suffix below.
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}
