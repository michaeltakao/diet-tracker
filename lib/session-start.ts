/**
 * Pure decision helpers for the /workout session-start flow (P0 #9, FTUE
 * roadmap): mapping the 3-level session-start energy picker onto the
 * existing 1–5 DailyCheckIn.energy scale, and picking a sensible default
 * training location from recent history + day of week.
 *
 * Pure/DI, no localStorage/DOM — mirrors lib/notifications.ts idiom so the
 * flow stays testable without a browser.
 */

import type { DailyCheckIn, FitnessGoal as ProfileFitnessGoal, MusclePart, WorkoutEntry } from '@/lib/types';
import type { Equipment } from '@/lib/exercise-db';
import type { TrainingLocation } from '@/lib/data/workout-prefs';
import type {
  FitnessGoal as TrainingGoal,
  TimeAvailableMin,
  RecentMuscleUse,
} from '@/lib/workout-generator';

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

/**
 * Map the health profile's `FitnessGoal` onto the training goal the
 * deterministic generator understands. The two vocabularies differ on
 * purpose: the profile describes a *body composition* intent, while the
 * generator needs a *set/rep scheme* intent.
 *
 * `muscle_gain` → hypertrophy and `weight_loss`/`endurance` → their
 * namesakes are direct. `maintenance` and `flexibility` have no generator
 * equivalent; both fall back to `hypertrophy`, the most generic
 * moderate-volume scheme — a deliberately conservative default rather than
 * an inferred claim about what those users want. Note the generator's
 * `strength` is unreachable from a profile goal; it is only selectable
 * directly in the dashboard's WorkoutGeneratorCard.
 */
export function profileGoalToTrainingGoal(goal: ProfileFitnessGoal | undefined): TrainingGoal {
  switch (goal) {
    case 'weight_loss': return 'weight_loss';
    case 'muscle_gain': return 'hypertrophy';
    case 'endurance':   return 'endurance';
    case 'maintenance':
    case 'flexibility':
    default:            return 'hypertrophy';
  }
}

/**
 * Snap an arbitrary session duration onto the generator's supported budget
 * steps, rounding DOWN so a plan never overruns the time the user said they
 * had. Anything under the smallest step still gets the smallest step — an
 * empty plan would be a worse answer than a short one.
 */
export function toTimeAvailableMin(duration: number | undefined): TimeAvailableMin {
  if (duration === undefined) return 30;
  const steps: TimeAvailableMin[] = [15, 30, 45, 60];
  let best: TimeAvailableMin = steps[0];
  for (const s of steps) if (duration >= s) best = s;
  return best;
}

/**
 * Collapse recent workout entries into the per-muscle-part recency the
 * generator consumes, keeping only the most recent day per part.
 *
 * Parameters
 * ----------
 * entries : readonly WorkoutEntry[]
 *     Recent entries; those without a `musclePart` are skipped (cardio and
 *     similar carry no part to recover).
 * today : string
 *     Reference date as `YYYY-MM-DD`; `daysAgo` is measured from it.
 *
 * Returns
 * -------
 * RecentMuscleUse[]
 *     One entry per distinct muscle part, each with the smallest `daysAgo`
 *     seen. Order follows first appearance, so the result is stable for a
 *     stable input — the generator is deterministic and must stay that way.
 */
export function toRecentMuscleParts(
  entries: readonly WorkoutEntry[],
  today: string,
): RecentMuscleUse[] {
  const todayMs = new Date(`${today}T00:00:00`).getTime();
  if (Number.isNaN(todayMs)) return [];

  const order: MusclePart[] = [];
  const minDaysAgo = new Map<MusclePart, number>();

  for (const e of entries) {
    const part = e.musclePart;
    if (!part) continue;
    const ms = new Date(`${e.date}T00:00:00`).getTime();
    if (Number.isNaN(ms)) continue;
    const daysAgo = Math.round((todayMs - ms) / 86_400_000);
    if (daysAgo < 0) continue; // future-dated entry: ignore rather than trust
    const prev = minDaysAgo.get(part);
    if (prev === undefined) {
      order.push(part);
      minDaysAgo.set(part, daysAgo);
    } else if (daysAgo < prev) {
      minDaysAgo.set(part, daysAgo);
    }
  }

  return order.map((musclePart) => ({ musclePart, daysAgo: minDaysAgo.get(musclePart)! }));
}

/**
 * Pick the next exercise for a swap so that repeated swaps of one slot walk
 * the whole alternative pool instead of toggling between two exercises.
 *
 * The toggle happened because "first alternative not in the plan" is
 * memoryless: after A→B, A is out of the plan and ranks near the top of B's
 * alternatives, so the next swap returns A. Remembering what was swapped out
 * breaks the cycle; when every alternative has been visited the pool's ids
 * are forgotten and the walk starts over (wrap).
 *
 * Parameters
 * ----------
 * pool : readonly string[]
 *     Alternative exercise ids, best first (see `alternativesFor`). Must not
 *     contain the exercise being swapped out.
 * inPlan : ReadonlySet<string>
 *     Ids currently in the plan; never offered, so the plan stays duplicate-free.
 * swappedOut : ReadonlySet<string>
 *     Ids already swapped out this session, *including* the one being replaced
 *     now. Not mutated.
 *
 * Returns
 * -------
 * { id: string; swappedOut: Set<string> } | null
 *     The replacement id and the swapped-out set to store next (with this
 *     pool's ids cleared if the walk wrapped). `null` when every alternative
 *     is already in the plan — the caller should treat the swap as unavailable.
 */
export function nextSwapCandidate(
  pool: readonly string[],
  inPlan: ReadonlySet<string>,
  swappedOut: ReadonlySet<string>,
): { id: string; swappedOut: Set<string> } | null {
  const fresh = pool.find((id) => !inPlan.has(id) && !swappedOut.has(id));
  if (fresh !== undefined) return { id: fresh, swappedOut: new Set(swappedOut) };

  const wrapped = pool.find((id) => !inPlan.has(id));
  if (wrapped === undefined) return null;
  const poolIds = new Set(pool);
  return { id: wrapped, swappedOut: new Set([...swappedOut].filter((id) => !poolIds.has(id))) };
}
