/**
 * Shared localStorage "have we celebrated this yet" helper (FTUE roadmap
 * phase 6 confetti/badge-pop wiring). Consolidates the try/catch
 * boilerplate that would otherwise be duplicated across each celebration
 * trigger — same idiom as lib/notifications.ts's localStorage callers,
 * just factored out since this one has 2+ call sites.
 */

export function hasCelebrated(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markCelebrated(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // storage unavailable — celebration simply may repeat next visit; harmless
  }
}
