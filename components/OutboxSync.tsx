'use client';

import { useEffect } from 'react';
import { flush, reportHealth } from '@/lib/data/outbox';

/**
 * Drives the IndexedDB outbox (ADR-008 P0-6): replays queued food / weight /
 * workout writes when the app opens, when the network comes back and when
 * the tab becomes visible; sends one sync-health row per app open.
 * Renders nothing.
 */
export function OutboxSync() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await flush();
      if (!cancelled) await reportHealth();
    })();

    const onOnline = () => { void flush(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
