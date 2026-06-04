import { useSyncExternalStore } from 'react';

/** No-op subscribe — hydration state never changes after the first commit. */
const emptySubscribe = (): (() => void) => () => {};

/**
 * Track whether the component has mounted on the client.
 *
 * Returns ``false`` during SSR and the initial hydration render, then ``true``
 * once committed on the client. Implemented with ``useSyncExternalStore`` so it
 * avoids the ``set-state-in-effect`` anti-pattern while remaining hydration-safe.
 *
 * Use to gate client-only UI — e.g. widgets that read the DOM or localStorage —
 * that would otherwise cause a server/client markup mismatch.
 *
 * Returns
 * -------
 * bool
 *     ``false`` on the server and first client render, ``true`` thereafter.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
