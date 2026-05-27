'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker at /sw.js.
 * Placed once in the root layout so it runs on every page.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log('[SW] registered:', reg.scope);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new version is available — could show a toast here
              console.log('[SW] new version available');
            }
          });
        });
      } catch (err) {
        console.warn('[SW] registration failed:', err);
      }
    };

    // Defer registration until after the page is interactive
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
