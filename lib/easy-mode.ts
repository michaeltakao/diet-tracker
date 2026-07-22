const EASY_MODE_KEY = 'diet-tracker:easy-mode';

/**
 * SSR-safe read: server always sees `false` so the first paint matches the
 * client's pre-hydration DOM (same pattern as getTextScale in
 * components/TextScaleInit.tsx). Callers apply the real value in a
 * client-only effect after mount.
 */
export function getStoredEasyMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(EASY_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setEasyMode(on: boolean): void {
  try {
    localStorage.setItem(EASY_MODE_KEY, on ? '1' : '0');
  } catch {
    // localStorage unavailable (private mode / quota) — caller's own state still updates
  }
}
