/**
 * Liftoff-inspired per-exercise strength rank — pure ratio → rank math.
 *
 * Unlike lib/rank.ts's account-wide XP ladder (Iron/Bronze/Silver/Platinum/
 * Diamond), this ranks a single lift by how the user's estimated 1RM
 * compares to their own bodyweight — "how strong are you at THIS lift,
 * relative to your size" (a 50kg bench is elite for a 45kg lifter, a
 * beginner level for a 100kg lifter). Deliberately distinct naming/tier
 * scheme from lib/rank.ts to avoid two different "Bronze"s appearing on the
 * same dashboard (user-approved decision).
 *
 * Five tiers (Novice → Elite), lower-bound inclusive on the ratio, plus a
 * sixth pseudo-state 'unranked' for users with no bodyweight logged yet —
 * 'unranked' is never a real achieved tier, just "can't compute yet".
 *
 * Scope: only the 10 curated weight-based starter exercises (see
 * EXERCISE_RANK_THRESHOLDS). Bodyweight/isometric moves (Crunch, Plank)
 * don't fit a 1RM/bodyweight-ratio model and are excluded from ranking in
 * this pass — not a bug, a deliberate v1 scope cut.
 */

export type ExerciseRankId = 'unranked' | 'novice' | 'intermediate' | 'advanced' | 'expert' | 'elite';

/** Ordered lowest → highest; 'unranked' excluded (not a real achieved tier). */
const TIER_ORDER: readonly Exclude<ExerciseRankId, 'unranked'>[] = [
  'novice', 'intermediate', 'advanced', 'expert', 'elite',
];

export interface ExerciseRankTierDef {
  colorVar: string;
  icon: 'feather' | 'weight' | 'flame' | 'bolt' | 'star';
}

export const EXERCISE_RANK_TIERS: Record<Exclude<ExerciseRankId, 'unranked'>, ExerciseRankTierDef> = {
  novice:       { colorVar: '--exrank-novice',       icon: 'feather' },
  intermediate: { colorVar: '--exrank-intermediate', icon: 'weight' },
  advanced:     { colorVar: '--exrank-advanced',     icon: 'flame' },
  expert:       { colorVar: '--exrank-expert',       icon: 'bolt' },
  elite:        { colorVar: '--exrank-elite',        icon: 'star' },
};

interface RatioThresholds {
  novice: number;
  intermediate: number;
  advanced: number;
  expert: number;
  elite: number;
}

export interface ExerciseRankThresholds {
  /** Matches ExerciseDef.id in lib/exercise-db.ts, e.g. 'bench-press'. */
  exerciseId: string;
  male: RatioThresholds;
  female: RatioThresholds;
}

/**
 * Ratio = estimated 1RM / bodyweight (both kg). Values below are **Opinion
 * — derived from published relative-strength-standard tables (e.g.
 * StrengthLevel / Symmetric Strength style ratio charts), not a personally
 * validated result.** Same epistemic status as the set/rep-scheme constants
 * in lib/workout-generator.ts: reasonable defaults, not a claim of
 * precision. Sex-unset users get the mean of male/female (reuses the
 * lib/nutrition-standards.ts convention).
 *
 * Isolation lifts (side-raise, arm-curl, triceps-pressdown) use much lower
 * ratios than compounds — a strong lateral raise is nowhere near
 * bodyweight, unlike a squat or deadlift.
 */
export const EXERCISE_RANK_THRESHOLDS: ExerciseRankThresholds[] = [
  { exerciseId: 'bench-press',        male: { novice: 0.5, intermediate: 0.75, advanced: 1.0,  expert: 1.5,  elite: 2.0  }, female: { novice: 0.25, intermediate: 0.4,  advanced: 0.6,  expert: 0.9,  elite: 1.25 } },
  { exerciseId: 'deadlift',           male: { novice: 0.75, intermediate: 1.25, advanced: 1.75, expert: 2.25, elite: 2.75 }, female: { novice: 0.5,  intermediate: 0.9,  advanced: 1.25, expert: 1.75, elite: 2.25 } },
  { exerciseId: 'barbell-squat',      male: { novice: 0.6,  intermediate: 1.0,  advanced: 1.5,  expert: 2.0,  elite: 2.5  }, female: { novice: 0.4,  intermediate: 0.7,  advanced: 1.1,  expert: 1.5,  elite: 1.9  } },
  { exerciseId: 'leg-press',          male: { novice: 1.0,  intermediate: 1.75, advanced: 2.5,  expert: 3.25, elite: 4.0  }, female: { novice: 0.75, intermediate: 1.25, advanced: 1.9,  expert: 2.5,  elite: 3.1  } },
  { exerciseId: 'lat-pulldown',       male: { novice: 0.4,  intermediate: 0.65, advanced: 0.9,  expert: 1.2,  elite: 1.5  }, female: { novice: 0.3,  intermediate: 0.5,  advanced: 0.7,  expert: 0.95, elite: 1.2  } },
  { exerciseId: 'shoulder-press',     male: { novice: 0.35, intermediate: 0.55, advanced: 0.75, expert: 1.0,  elite: 1.25 }, female: { novice: 0.2,  intermediate: 0.32, advanced: 0.45, expert: 0.6,  elite: 0.8  } },
  { exerciseId: 'side-raise',         male: { novice: 0.06, intermediate: 0.1,  advanced: 0.15, expert: 0.2,  elite: 0.27 }, female: { novice: 0.04, intermediate: 0.07, advanced: 0.1,  expert: 0.14, elite: 0.19 } },
  { exerciseId: 'arm-curl',           male: { novice: 0.2,  intermediate: 0.32, advanced: 0.45, expert: 0.6,  elite: 0.75 }, female: { novice: 0.12, intermediate: 0.2,  advanced: 0.28, expert: 0.38, elite: 0.5  } },
  { exerciseId: 'triceps-pressdown',  male: { novice: 0.25, intermediate: 0.4,  advanced: 0.55, expert: 0.75, elite: 0.95 }, female: { novice: 0.15, intermediate: 0.25, advanced: 0.35, expert: 0.48, elite: 0.63 } },
];

const THRESHOLDS_BY_ID = new Map(EXERCISE_RANK_THRESHOLDS.map((t) => [t.exerciseId, t]));

/** True when `exerciseId` is one of the 10 curated lifts this system ranks. */
export function isRankableExercise(exerciseId: string): boolean {
  return THRESHOLDS_BY_ID.has(exerciseId);
}

export interface ExerciseRankProgress {
  rank: ExerciseRankId;
  nextRank: ExerciseRankId | null;
  ratio: number | null;              // null when unranked (no bodyweight on file)
  currentRatioThreshold: number | null;
  nextRatioThreshold: number | null;
}

function resolveThresholds(
  t: ExerciseRankThresholds,
  sex: 'male' | 'female' | null | undefined,
): RatioThresholds {
  if (sex === 'male' || sex === 'female') return t[sex];
  return {
    novice:       (t.male.novice + t.female.novice) / 2,
    intermediate: (t.male.intermediate + t.female.intermediate) / 2,
    advanced:     (t.male.advanced + t.female.advanced) / 2,
    expert:       (t.male.expert + t.female.expert) / 2,
    elite:        (t.male.elite + t.female.elite) / 2,
  };
}

/**
 * Resolve an exercise's 1RM + the user's bodyweight/sex to a rank tier.
 *
 * Parameters
 * ----------
 * exerciseId : ExerciseDef.id — must be one of the 10 curated rankable
 *   lifts (see isRankableExercise); unknown ids return null (not rankable,
 *   not an error — most of the 210-exercise DB is intentionally unranked).
 * est1RM : estimated one-rep max in kg (see lib/onerm.ts). Non-positive or
 *   non-finite values are treated as 0.
 * bodyweightKg : latest logged bodyweight in kg, or null/undefined when the
 *   user hasn't logged one yet. null bodyweight is a real, expected state
 *   — not an error — and always resolves to 'unranked'.
 * sex : profile.sex; null/undefined averages male/female thresholds
 *   (mirrors lib/nutrition-standards.ts's sex-averaging convention).
 *
 * Returns
 * -------
 * ExerciseRankProgress, or null when exerciseId is not one of the 10
 * curated rankable lifts.
 */
export function getExerciseRank(
  exerciseId: string,
  est1RM: number,
  bodyweightKg: number | null | undefined,
  sex: 'male' | 'female' | null | undefined,
): ExerciseRankProgress | null {
  const t = THRESHOLDS_BY_ID.get(exerciseId);
  if (!t) return null;

  if (bodyweightKg == null || !Number.isFinite(bodyweightKg) || bodyweightKg <= 0) {
    return { rank: 'unranked', nextRank: null, ratio: null, currentRatioThreshold: null, nextRatioThreshold: null };
  }

  const safe1RM = Number.isFinite(est1RM) && est1RM > 0 ? est1RM : 0;
  const ratio = safe1RM / bodyweightKg;
  const thresholds = resolveThresholds(t, sex);

  let current: Exclude<ExerciseRankId, 'unranked'> | null = null;
  let currentThreshold: number | null = null;
  for (const tier of TIER_ORDER) {
    if (ratio >= thresholds[tier]) {
      current = tier;
      currentThreshold = thresholds[tier];
    } else break;
  }

  if (current === null) {
    // Below the novice floor — still 'unranked' (hasn't earned a tier yet),
    // distinct from "no bodyweight data" but same display state.
    return { rank: 'unranked', nextRank: 'novice', ratio, currentRatioThreshold: null, nextRatioThreshold: thresholds.novice };
  }

  const idx = TIER_ORDER.indexOf(current);
  const next = TIER_ORDER[idx + 1] ?? null;

  return {
    rank: current,
    nextRank: next,
    ratio,
    currentRatioThreshold: currentThreshold,
    nextRatioThreshold: next ? thresholds[next] : null,
  };
}

const EXERCISE_RANK_ORDER: Record<ExerciseRankId, number> = {
  unranked: -1, novice: 0, intermediate: 1, advanced: 2, expert: 3, elite: 4,
};

/** True when `rank` is strictly higher than `other` in the unranked→elite ordering. */
export function isExerciseRankHigher(rank: ExerciseRankId, other: ExerciseRankId): boolean {
  return EXERCISE_RANK_ORDER[rank] > EXERCISE_RANK_ORDER[other];
}

const EXERCISE_RANK_IDS: readonly ExerciseRankId[] = ['unranked', 'novice', 'intermediate', 'advanced', 'expert', 'elite'];

/**
 * Type guard for untrusted input (e.g. a restored JSON backup — see
 * lib/export.ts mergeBackup — where `incoming` is a raw `as AppData` cast
 * with no runtime validation upstream). Rejects any string outside the six
 * known tier ids so a malformed/tampered backup can never write a rank
 * value that EXERCISE_RANK_TIERS[state.rank] would resolve to `undefined`
 * for at render time.
 */
export function isExerciseRankId(v: unknown): v is ExerciseRankId {
  return typeof v === 'string' && (EXERCISE_RANK_IDS as readonly string[]).includes(v);
}
