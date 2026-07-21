/**
 * Session-start preferences: location, per-location equipment, last chosen
 * duration, and a short rolling history of location choices.
 *
 * localStorage-ONLY by design (no Supabase mirror): this is per-device UX
 * context for the AI suggestion prompt, not study data — the same stance as
 * StreakState. A phone at the gym and a laptop at home can legitimately hold
 * different values. Revisit if the research protocol ever needs it.
 *
 * P0 #9 (FTUE roadmap): superseded the old {environment, equipment} shape
 * (single location, single equipment list) with a per-location equipment
 * map + location history, to support the /workout session-start flow
 * (location chips → duration chips → equipment presets). Old-shape values
 * are migrated losslessly in memory on read — see migrateLegacy() below.
 */

import type { Equipment } from '@/lib/exercise-db';

export type TrainingLocation = 'home' | 'gym' | 'hotel_gym' | 'outdoor' | 'rest_day';
/** 60 means "60+" in the UI. */
export type SessionDuration = 15 | 30 | 45 | 60;

export interface WorkoutPrefs {
  lastLocation?: TrainingLocation;
  equipmentByLocation: Partial<Record<TrainingLocation, Equipment[]>>;
  lastDuration?: SessionDuration;
  /** Most recent choices first, capped at MAX_RECENT_LOCATIONS. */
  recentLocations: Array<{ date: string; location: TrainingLocation }>;
}

/** Old (pre-P0#9) on-disk shape, kept only for migration. */
interface LegacyWorkoutPrefs {
  environment?: 'home' | 'gym';
  equipment?: unknown;
}

const KEY = 'diet-tracker:workout-prefs';
const MAX_RECENT_LOCATIONS = 20;

const VALID_LOCATIONS: readonly string[] = ['home', 'gym', 'hotel_gym', 'outdoor', 'rest_day'];
const VALID_DURATIONS: readonly number[] = [15, 30, 45, 60];
const VALID_EQUIPMENT: readonly string[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

function emptyPrefs(): WorkoutPrefs {
  return { equipmentByLocation: {}, recentLocations: [] };
}

function isValidLocation(v: unknown): v is TrainingLocation {
  return typeof v === 'string' && VALID_LOCATIONS.includes(v);
}

function sanitizeEquipmentList(v: unknown): Equipment[] {
  return Array.isArray(v)
    ? (v.filter((e) => VALID_EQUIPMENT.includes(e as string)) as Equipment[])
    : [];
}

/**
 * Lossless upgrade from the pre-P0#9 shape: the old single `environment` +
 * `equipment` list becomes `lastLocation` + `equipmentByLocation[environment]`.
 * A pre-existing `equipment` list with no `environment` set is attributed to
 * 'home' (the old default UI showed the equipment picker only for 'home').
 */
function migrateLegacy(parsed: LegacyWorkoutPrefs): WorkoutPrefs {
  const prefs = emptyPrefs();
  const equipment = sanitizeEquipmentList(parsed.equipment);
  const location = parsed.environment === 'gym' ? 'gym' : parsed.environment === 'home' ? 'home' : undefined;
  if (location) {
    prefs.lastLocation = location;
    if (equipment.length > 0) prefs.equipmentByLocation[location] = equipment;
  } else if (equipment.length > 0) {
    prefs.equipmentByLocation.home = equipment;
  }
  return prefs;
}

function isNewShape(parsed: Record<string, unknown>): boolean {
  return 'equipmentByLocation' in parsed || 'recentLocations' in parsed || 'lastLocation' in parsed || 'lastDuration' in parsed;
}

/** Read prefs (SSR-safe; unknown/malformed values are dropped, not propagated). */
export function getWorkoutPrefs(): WorkoutPrefs {
  if (typeof window === 'undefined') return emptyPrefs();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyPrefs();
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!isNewShape(parsed)) {
      return migrateLegacy(parsed as LegacyWorkoutPrefs);
    }

    const prefs = emptyPrefs();
    if (isValidLocation(parsed.lastLocation)) prefs.lastLocation = parsed.lastLocation;
    if (VALID_DURATIONS.includes(parsed.lastDuration as number)) {
      prefs.lastDuration = parsed.lastDuration as SessionDuration;
    }
    const rawMap = parsed.equipmentByLocation;
    if (rawMap && typeof rawMap === 'object') {
      for (const [loc, list] of Object.entries(rawMap as Record<string, unknown>)) {
        if (!isValidLocation(loc)) continue;
        const equipment = sanitizeEquipmentList(list);
        if (equipment.length > 0) prefs.equipmentByLocation[loc] = equipment;
      }
    }
    if (Array.isArray(parsed.recentLocations)) {
      prefs.recentLocations = (parsed.recentLocations as Array<Record<string, unknown>>)
        .filter((r) => typeof r.date === 'string' && isValidLocation(r.location))
        .map((r) => ({ date: r.date as string, location: r.location as TrainingLocation }))
        .slice(0, MAX_RECENT_LOCATIONS);
    }
    return prefs;
  } catch {
    return emptyPrefs();
  }
}

export function saveWorkoutPrefs(prefs: WorkoutPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Quota/private-mode failures are non-fatal — prefs simply don't persist.
  }
}

/**
 * Append a location choice to the rolling history (most recent first) and
 * persist, capped at MAX_RECENT_LOCATIONS. Does not itself set lastLocation
 * — callers that want that should also update lastLocation explicitly.
 */
export function recordLocationChoice(location: TrainingLocation, date: string): void {
  const prefs = getWorkoutPrefs();
  prefs.recentLocations = [{ date, location }, ...prefs.recentLocations].slice(0, MAX_RECENT_LOCATIONS);
  saveWorkoutPrefs(prefs);
}
