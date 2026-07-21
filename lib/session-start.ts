/**
 * Pure decision helpers for the /workout session-start flow (P0 #9, FTUE
 * roadmap): mapping the 3-level session-start energy picker onto the
 * existing 1–5 DailyCheckIn.energy scale, and picking a sensible default
 * training location from recent history + day of week.
 *
 * Pure/DI, no localStorage/DOM — mirrors lib/notifications.ts idiom so the
 * flow stays testable without a browser.
 */

import type { DailyCheckIn } from '@/lib/types';
import type { Equipment } from '@/lib/exercise-db';
import type { TrainingLocation } from '@/lib/data/workout-prefs';

export type EnergyLevel = 'low' | 'medium' | 'high';

/**
 * Deliberately lossy: the 3-level session-start picker (😫🙂🔥) is a faster
 * input than the existing 1–5 DailyCheckIn.energy scale, not a replacement
 * for it. Mapping low→2/medium→3/high→4 keeps written history (streak
 * charts, WeeklyReportCard) on the same 1–5 axis instead of forking it.
 */
export function energyLevelToScale(level: EnergyLevel): DailyCheckIn['energy'] {
  switch (level) {
    case 'low':    return 2;
    case 'medium': return 3;
    case 'high':   return 4;
  }
}

/**
 * Equipment assumed available at each location, used to pre-fill (but not
 * lock) the equipment chip picker. 'hotel_gym' mirrors 'gym' — the simplest
 * defensible default until real usage data suggests otherwise (hotel gyms
 * vary widely, but skewing toward "assume equipped" avoids under-suggesting
 * to someone who image-searches their hotel's actual gym).
 */
export const LOCATION_EQUIPMENT_DEFAULTS: Record<TrainingLocation, Equipment[]> = {
  home:      [],
  gym:       ['barbell', 'dumbbell', 'machine', 'cable'],
  hotel_gym: ['barbell', 'dumbbell', 'machine', 'cable'],
  outdoor:   ['bodyweight'],
  rest_day:  [],
};

/**
 * Pick a default location from recent history: the most common location
 * chosen on this weekday (ties broken by most-recent), falling back to the
 * single most-recent choice overall, then to `fallback` (typically
 * lastLocation), then undefined (no default — flow starts with nothing
 * selected).
 */
export function pickDefaultLocation(
  recentLocations: ReadonlyArray<{ date: string; location: TrainingLocation }>,
  weekday: number,
  fallback?: TrainingLocation,
): TrainingLocation | undefined {
  const sameWeekday = recentLocations.filter((r) => {
    const d = new Date(`${r.date}T00:00:00`);
    return !Number.isNaN(d.getTime()) && d.getDay() === weekday;
  });

  if (sameWeekday.length > 0) {
    const counts = new Map<TrainingLocation, number>();
    for (const r of sameWeekday) counts.set(r.location, (counts.get(r.location) ?? 0) + 1);
    let best: TrainingLocation = sameWeekday[0].location;
    let bestCount = 0;
    // sameWeekday is assumed most-recent-first (matches recordLocationChoice's
    // unshift order), so the first occurrence at the max count is also the
    // most-recent among ties.
    for (const r of sameWeekday) {
      const c = counts.get(r.location)!;
      if (c > bestCount) { bestCount = c; best = r.location; }
    }
    return best;
  }

  if (recentLocations.length > 0) return recentLocations[0].location;

  return fallback;
}
