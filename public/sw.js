/**
 * Diet Tracker — Service Worker
 *
 * Strategy:
 *   /_next/static/*  → CacheFirst  (immutable hashed assets)
 *   /api/*           → NetworkOnly (never cache API calls)
 *   pages            → NetworkFirst with offline fallback
 *   images           → CacheFirst with 7-day TTL
 */

const APP_VERSION  = 'diet-tracker-v1';
const STATIC_CACHE = `${APP_VERSION}-static`;
const PAGES_CACHE  = `${APP_VERSION}-pages`;
const IMG_CACHE    = `${APP_VERSION}-images`;

// App-shell pages to pre-cache on install
const PRECACHE_PAGES = ['/', '/add', '/log', '/workout', '/weight', '/settings'];

// ── Install ────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) =>
      cache.addAll(PRECACHE_PAGES).catch(() => {
        // Non-fatal: some pages may not be cacheable at install time
      })
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  const VALID = new Set([STATIC_CACHE, PAGES_CACHE, IMG_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !VALID.has(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // Skip non-GET
  if (request.method !== 'GET') return;

  // ① Next.js static assets — CacheFirst (hash ensures freshness)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ② API routes — NetworkOnly (always fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // ③ Image files — CacheFirst with 7-day soft TTL
  if (/\.(png|jpg|jpeg|svg|webp|gif|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  // ④ App pages — NetworkFirst with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // ⑤ Everything else — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, PAGES_CACHE));
});

// ── Web Push (FTUE P0 #7) ──────────────────────────────────
// Payloads are built server-side (app/api/push-send) from static templates:
// { title, body, url }. Malformed payloads are dropped silently.

self.addEventListener('push', (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    // non-JSON push (e.g. DevTools test box with plain text) → generic body
    payload = { title: 'Diet Tracker', body: event.data ? event.data.text() : '', url: '/' };
  }
  if (!payload || !payload.title) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body || '',
      icon: '/icon',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        // Reuse any same-origin window: focus it and navigate to the target.
        if (new URL(win.url).origin === location.origin) {
          return win.focus().then((focused) =>
            'navigate' in focused ? focused.navigate(url) : focused
          );
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Strategies ─────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline fallback: return root if we have it
    const root = await cache.match('/');
    if (root) return root;
    return new Response(
      '<html><body style="font-family:sans-serif;padding:2rem;text-align:center">' +
      '<h1>📶 オフライン</h1>' +
      '<p>インターネット接続を確認してください。</p>' +
      '</body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const freshPromise = fetch(request).then((fresh) => {
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  });
  return cached ?? freshPromise;
}
