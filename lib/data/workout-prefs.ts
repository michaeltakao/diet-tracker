/**
 * Training-environment preference (home/gym + available equipment).
 *
 * localStorage-ONLY by design (no Supabase mirror): this is per-device UX
 * context for the AI suggestion prompt, not study data — the same stance as
 * StreakState. A phone at the gym and a laptop at home can legitimately hold
 * different values. Revisit if the research protocol ever needs it.
 */

import type { Equipment } from '@/lib/exercise-db';

export type TrainingEnvironment = 'home' | 'gym';

export interface WorkoutPrefs {
  environment?: TrainingEnvironment;
  /** Equipment available to the user (relevant mainly for 'home'). */
  equipment: Equipment[];
}

const KEY = 'diet-tracker:workout-prefs';

const VALID_ENVIRONMENTS: readonly string[] = ['home', 'gym'];
const VALID_EQUIPMENT: readonly string[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

/** Read prefs (SSR-safe; unknown values are dropped, not propagated). */
export function getWorkoutPrefs(): WorkoutPrefs {
  if (typeof window === 'undefined') return { equipment: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { equipment: [] };
    const parsed = JSON.parse(raw) as { environment?: unknown; equipment?: unknown };
    const environment = VALID_ENVIRONMENTS.includes(parsed.environment as string)
      ? (parsed.environment as TrainingEnvironment)
      : undefined;
    const equipment = Array.isArray(parsed.equipment)
      ? (parsed.equipment.filter((e) => VALID_EQUIPMENT.includes(e as string)) as Equipment[])
      : [];
    return { environment, equipment };
  } catch {
    return { equipment: [] };
  }
}

export function saveWorkoutPrefs(prefs: WorkoutPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Quota/private-mode failures are non-fatal — prefs simply don't persist.
  }
}
