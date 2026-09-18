/**
 * Deterministic workout-plan generator (AI Personal Trainer, phase 1).
 *
 * Design decision (user-approved, see plan): exercise/set/rep selection is
 * fully deterministic here — no LLM call in this module. The `/api/generate-
 * workout` route calls {@link selectExercises} first and only afterwards asks
 * Gemini to *narrate* the already-decided plan (session name, ordering
 * rationale, motivation). This matches the "environment-aware deterministic
 * engine decides, LLM only narrates" principle in
 * docs/roadmaps/REDESIGN_ROADMAP_2026-07.md — the LLM cannot alter which
 * exercises, sets, or reps a user gets, only how they're described.
 *
 * Kept separate from `/api/suggest-workout` (which stays scoped to "adjust
 * today's already-scheduled session") to avoid a two-jobs-in-one-route fork.
 */

import { EXERCISE_DB, type ExerciseDef, type Equipment } from '@/lib/exercise-db';
import type { MusclePart } from '@/lib/types';

export type FitnessGoal = 'hypertrophy' | 'strength' | 'endurance' | 'weight_loss';
export type TimeAvailableMin = 15 | 30 | 45 | 60;

export type EnergyLevel = 'low' | 'medium' | 'high';

/** A muscle part trained `daysAgo` days before today (0 = today). */
export interface RecentMuscleUse {
  musclePart: MusclePart;
  daysAgo: number;
}

export interface GeneratePlanInput {
  goal: FitnessGoal;
  /** Equipment the user has access to. `bodyweight` is always implicitly available. */
  availableEquipment: Equipment[];
  timeAvailableMin: TimeAvailableMin;
  /** Optional muscle-group focus; omitted/empty means "any muscle part". */
  targetBodyParts?: MusclePart[];
  /**
   * Muscle groups the user reported as sore today. Deprioritized, and dropped
   * entirely when enough non-sore work remains — see {@link selectExercises}.
   * Deliberately NOT a medical contraindication check: this is a scheduling
   * preference, not clinical advice.
   */
  sorenessAreas?: MusclePart[];
  /** Self-reported energy today; shifts set volume by one step. */
  energyLevel?: EnergyLevel;
  /** Recent training history, used for recovery-aware part ordering. */
  recentMuscleParts?: RecentMuscleUse[];
}

export interface GeneratedExercise {
  exercise: ExerciseDef;
  sets: number;
  /** Rep range as a display string, e.g. "8-12" (not a single number — see SET_SCHEMES). */
  reps: string;
  restSec: number;
}

export interface GeneratedPlan {
  exercises: GeneratedExercise[];
  estimatedDurationMin: number;
}

interface SetScheme {
  sets: number;
  reps: string;
  restSec: number;
}

/**
 * Sets/reps/rest by goal, per standard strength-training convention.
 *
 * **Opinion / domain convention** (not a personally validated experimental
 * result): these are widely-cited rules of thumb, not derived from this
 * project's own data. hypertrophy ≈ 3×10-12 @ 60-90s; strength ≈ 5×5 @
 * 2-3min (heavier loads need longer recovery between near-maximal sets);
 * endurance ≈ 3×15-20 @ 30-45s (short rest keeps the stimulus metabolic);
 * weight_loss ≈ 3×12-15 @ 45-60s (higher density than strength/hypertrophy
 * to keep heart rate elevated).
 */
const SET_SCHEMES: Record<FitnessGoal, SetScheme> = {
  hypertrophy: { sets: 3, reps: '10-12', restSec: 75 },
  strength:    { sets: 5, reps: '5',     restSec: 150 },
  endurance:   { sets: 3, reps: '15-20', restSec: 40 },
  weight_loss: { sets: 3, reps: '12-15', restSec: 50 },
};

/**
 * Rough exercise-count budget per available time, assuming ~8-10 minutes per
 * exercise including its own rest periods (a set-and-rest cycle at typical
 * gym pace). **Opinion / rough heuristic**, not a measured figure — a
 * reasonable starting point rather than a precisely calibrated model, and
 * intentionally conservative to avoid promising more than fits.
 */
const EXERCISE_COUNT_BY_TIME: Record<TimeAvailableMin, number> = {
  15: 2,
  30: 3,
  45: 5,
  60: 6,
};

const MINUTES_PER_EXERCISE = 9;

/**
 * Set-count delta applied to the goal's scheme from self-reported energy.
 *
 * **Opinion / conservative heuristic.** One set in either direction is a
 * deliberately small lever: it keeps a low-energy session recognizably the
 * same workout (autoregulation, not a different plan) while still lowering
 * total volume, which is the variable most plausibly worth trimming on a bad
 * day. Never drops below MIN_SETS — a 1-set "session" would be a worse
 * experience than simply resting, and Rest Day is already an explicit choice
 * upstream in the session-start flow.
 */
const ENERGY_SET_DELTA: Record<EnergyLevel, number> = {
  low:    -1,
  medium:  0,
  high:   +1,
};

const MIN_SETS = 2;

/**
 * Days after which a muscle part is treated as fully recovered. Parts trained
 * more recently than this are ordered later, so the round-robin reaches
 * better-rested parts first.
 *
 * **Opinion / domain convention**: 48h is the commonly cited floor for
 * resistance-trained muscle protein synthesis to settle, not a value measured
 * from this project's data.
 */
const RECOVERY_DAYS = 2;

/**
 * Select a deterministic set of exercises for the given constraints.
 *
 * Selection logic
 * ----------------
 * 1. Filter `EXERCISE_DB` to exercises whose equipment is in
 *    `availableEquipment` (bodyweight is always implicitly included) and,
 *    when `targetBodyParts` is non-empty, whose `musclePart` is in that set.
 * 2. Determine the exercise count from `timeAvailableMin`.
 * 3. Split candidates into non-sore and sore halves (see `sorenessAreas`).
 *    Sore parts are used only to top up a plan that the non-sore pool could
 *    not fill — so soreness is a strong preference, never a hard failure.
 * 4. Fill compound (`isCompound: true`) exercises first — they recruit more
 *    muscle mass per set, a standard strength-training prioritization for
 *    time-constrained sessions — then fill remaining slots with isolation
 *    work. Both fills round-robin across the represented muscle parts so no
 *    single part crowds out the others. Part order within the round-robin is
 *    recovery-aware: parts not trained within `RECOVERY_DAYS` come first
 *    (see `recentMuscleParts`). Within a part, exercises whose movement
 *    `pattern` has been used less in this plan are preferred, so a session
 *    spans movement patterns rather than stacking three presses.
 * 5. Apply the goal's set/rep/rest scheme to every selected exercise, shifted
 *    by `energyLevel` (see ENERGY_SET_DELTA).
 *
 * Determinism: `EXERCISE_DB` order is fixed, every sort below is applied to a
 * stable key with the original index as the final tie-break, and no clock or
 * PRNG is read — so the same input always yields the same output. This is
 * what makes {@link selectExercises} unit-testable without mocking anything,
 * and it is a property the tests assert directly.
 *
 * Complexity: O(n log n) in `EXERCISE_DB.length` (the candidate sorts);
 * the fill loops are bounded by `targetCount`, which is at most 6.
 *
 * Parameters
 * ----------
 * input : GeneratePlanInput
 *
 * Returns
 * -------
 * GeneratedPlan
 *     Possibly with an empty `exercises` array when no exercise matches the
 *     equipment/body-part filter — this is a real, expected outcome (e.g. a
 *     user who selects only `cable` equipment with no gym cable machine
 *     available at home), not an error condition. Callers must handle it.
 *     Soreness alone never produces an empty plan: if every candidate part is
 *     sore, the sore candidates are used anyway rather than returning nothing.
 */
export function selectExercises(input: GeneratePlanInput): GeneratedPlan {
  const equipmentSet = new Set<Equipment>([...input.availableEquipment, 'bodyweight']);
  const bodyPartSet = input.targetBodyParts && input.targetBodyParts.length > 0
    ? new Set(input.targetBodyParts)
    : null;

  const candidates = EXERCISE_DB.filter((e) => {
    if (!equipmentSet.has(e.equipment)) return false;
    if (bodyPartSet && !bodyPartSet.has(e.musclePart)) return false;
    return true;
  });

  const targetCount = EXERCISE_COUNT_BY_TIME[input.timeAvailableMin];
  const scheme = SET_SCHEMES[input.goal];

  const soreSet = new Set(input.sorenessAreas ?? []);

  /**
   * Most recent training day per muscle part. A part absent from the map has
   * no recent record and is treated as fully rested.
   */
  const lastTrained = new Map<MusclePart, number>();
  for (const r of input.recentMuscleParts ?? []) {
    const prev = lastTrained.get(r.musclePart);
    if (prev === undefined || r.daysAgo < prev) lastTrained.set(r.musclePart, r.daysAgo);
  }

  /** Lower sorts earlier: rested parts before recently-trained ones. */
  function recoveryRank(part: MusclePart): number {
    const daysAgo = lastTrained.get(part);
    if (daysAgo === undefined || daysAgo >= RECOVERY_DAYS) return 0;
    // 1 for trained yesterday, 2 for trained today — least rested goes last.
    return RECOVERY_DAYS - daysAgo;
  }

  const selected: ExerciseDef[] = [];
  const usedIds = new Set<string>();
  /** Movement patterns already used in this plan, for pattern diversity. */
  const patternCounts = new Map<string, number>();

  /**
   * Fills remaining slots from `pool`, round-robining across muscle parts so a
   * single part never crowds out the others — this matters both when multiple
   * `targetBodyParts` were requested and when none were (a "full body" plan
   * should span muscle groups rather than exhausting EXERCISE_DB's chest-first
   * array order).
   *
   * Parts are visited in recovery order (best-rested first). Within a part,
   * the next exercise is the one whose movement pattern is least represented
   * in the plan so far, with the pool's original order as a stable tie-break.
   */
  function roundRobinFill(pool: readonly ExerciseDef[]): void {
    if (selected.length >= targetCount || pool.length === 0) return;

    const byPart = new Map<MusclePart, ExerciseDef[]>();
    for (const e of pool) {
      if (!byPart.has(e.musclePart)) byPart.set(e.musclePart, []);
      byPart.get(e.musclePart)!.push(e);
    }

    // Stable sort: recovery rank first, first-seen order as the tie-break.
    const parts = [...byPart.keys()]
      .map((part, idx) => ({ part, idx, rank: recoveryRank(part) }))
      .sort((a, b) => a.rank - b.rank || a.idx - b.idx)
      .map((x) => x.part);

    let partIdx = 0;
    let guard = 0;
    const guardLimit = pool.length * parts.length + 1;

    while (selected.length < targetCount && guard < guardLimit) {
      guard++;
      const part = parts[partIdx % parts.length];
      partIdx++;
      const queue = byPart.get(part);

      if (queue && queue.length > 0) {
        // Prefer the least-used movement pattern; ties keep pool order.
        let bestIdx = 0;
        let bestCount = Infinity;
        for (let i = 0; i < queue.length; i++) {
          const count = patternCounts.get(queue[i].pattern ?? 'unknown') ?? 0;
          if (count < bestCount) { bestCount = count; bestIdx = i; }
        }
        const [e] = queue.splice(bestIdx, 1);
        if (!usedIds.has(e.id)) {
          selected.push(e);
          usedIds.add(e.id);
          const key = e.pattern ?? 'unknown';
          patternCounts.set(key, (patternCounts.get(key) ?? 0) + 1);
        }
      }

      if (parts.every((pt) => (byPart.get(pt)?.length ?? 0) === 0)) break;
    }
  }

  // Non-sore parts first, in the usual compound-before-isolation order. Sore
  // parts are only reached if the non-sore pool could not fill the plan.
  const fresh = candidates.filter((e) => !soreSet.has(e.musclePart));
  const sore  = candidates.filter((e) => soreSet.has(e.musclePart));

  roundRobinFill(fresh.filter((e) => e.isCompound));
  roundRobinFill(fresh.filter((e) => !e.isCompound));
  roundRobinFill(sore.filter((e) => e.isCompound));
  roundRobinFill(sore.filter((e) => !e.isCompound));

  const sets = Math.max(
    MIN_SETS,
    scheme.sets + (input.energyLevel ? ENERGY_SET_DELTA[input.energyLevel] : 0),
  );

  const exercises: GeneratedExercise[] = selected.map((exercise) => ({
    exercise,
    sets,
    reps: scheme.reps,
    restSec: scheme.restSec,
  }));

  return {
    exercises,
    estimatedDurationMin: exercises.length * MINUTES_PER_EXERCISE,
  };
}
