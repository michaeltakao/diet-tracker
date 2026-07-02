/**
 * Local usage telemetry (Phase C groundwork).
 *
 * Events are buffered in a dedicated localStorage key — deliberately NOT part
 * of AppData, so telemetry never rides along in data export/import or the
 * Supabase dual-write. Server-side collection is deferred until it has its own
 * migration and consent gating.
 *
 * The buffer is capped FIFO at MAX_EVENTS; all functions swallow storage
 * errors (private mode, quota) — telemetry must never break the app.
 */

const STORAGE_KEY = 'diet-tracker:telemetry';
export const MAX_EVENTS = 500;

export type TelemetryEventName =
  | 'trends_viewed'
  | 'trends_range_changed'
  | 'weekly_view_viewed';

export interface TelemetryEvent {
  name: TelemetryEventName;
  at: string; // ISO timestamp
  meta?: Record<string, string | number | boolean>;
}

export function recordEvent(
  name: TelemetryEventName,
  meta?: TelemetryEvent['meta'],
): void {
  try {
    const events = getEvents();
    events.push({ name, at: new Date().toISOString(), ...(meta ? { meta } : {}) });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // storage unavailable or full — drop silently
  }
}

export function getEvents(): TelemetryEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

export function clearEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
