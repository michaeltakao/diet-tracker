/**
 * Hand-off of an "undo" from /add to /dashboard (UX P0 slice 3).
 *
 * A quick add on /add navigates to the dashboard right away, so the undo
 * toast must be shown there. sessionStorage (this tab only) carries the ids
 * just written and a label; the dashboard takes it once on mount. A hint
 * older than `maxAgeMs` is ignored so a later visit never offers to undo
 * something the user has long since moved on from.
 */
const KEY = 'diet-tracker:undo-hint';

export interface UndoHint {
  ids: string[];
  label: string;
  at: number;
}

export function setUndoHint(ids: string[], label: string, now = Date.now()): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ids, label, at: now } satisfies UndoHint));
  } catch {
    // Storage unavailable (private mode quota): no undo, the write itself stands.
  }
}

export function takeUndoHint(now = Date.now(), maxAgeMs = 10_000): UndoHint | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const h = JSON.parse(raw) as Partial<UndoHint>;
    if (!Array.isArray(h.ids) || typeof h.label !== 'string' || typeof h.at !== 'number') return null;
    if (now - h.at > maxAgeMs || now < h.at) return null;
    return { ids: h.ids.filter((x): x is string => typeof x === 'string'), label: h.label, at: h.at };
  } catch {
    return null;
  }
}
