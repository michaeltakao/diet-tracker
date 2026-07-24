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

export interface GeneratePlanInput {
  goal: FitnessGoal;
  /** Equipment the user has access to. `bodyweight` is always implicitly available. */
  availableEquipment: Equipment[];
  timeAvailableMin: TimeAvailableMin;
  /** Optional muscle-group focus; omitted/empty means "any muscle part". */
  targetBodyParts?: MusclePart[];
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
 * Select a deterministic set of exercises for the given constraints.
 *
 * Selection logic
 * ----------------
 * 1. Filter `EXERCISE_DB` to exercises whose equipment is in
 *    `availableEquipment` (bodyweight is always implicitly included) and,
 *    when `targetBodyParts` is non-empty, whose `musclePart` is in that set.
 * 2. Determine the exercise count from `timeAvailableMin`.
 * 3. Fill compound (`isCompound: true`) exercises first — they recruit more
 *    muscle mass per set, a standard strength-training prioritization for
 *    time-constrained sessions — then fill remaining slots with isolation
 *    work. Both fills round-robin across the represented muscle parts (in
 *    first-seen order) so no single part crowds out the others, whether from
 *    an explicit multi-part `targetBodyParts` request or simply from
 *    `EXERCISE_DB`'s fixed per-category array order.
 * 4. Apply the goal's set/rep/rest scheme uniformly to every selected
 *    exercise (a simple, transparent policy — no per-exercise tuning yet).
 *
 * Determinism: `EXERCISE_DB` order is fixed, and all filtering/sorting below
 * is stable, so the same input always yields the same output — this is what
 * makes {@link selectExercises} unit-testable without mocking a clock or PRNG.
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

  const compounds = candidates.filter((e) => e.isCompound);
  const isolations = candidates.filter((e) => !e.isCompound);

  const selected: ExerciseDef[] = [];
  const usedIds = new Set<string>();

  /**
   * Fills up to `remaining` slots from `pool`, round-robining across muscle
   * parts (in first-seen order) so a single part never crowds out the
   * others — matters both when multiple `targetBodyParts` were requested and
   * when none were (a "full body" plan should still span muscle groups
   * rather than exhausting EXERCISE_DB's chest-first array order).
   */
  function roundRobinFill(pool: readonly ExerciseDef[], remaining: number): void {
    if (remaining <= 0 || pool.length === 0) return;
    const byPart = new Map<MusclePart, ExerciseDef[]>();
    for (const e of pool) {
      if (!byPart.has(e.musclePart)) byPart.set(e.musclePart, []);
      byPart.get(e.musclePart)!.push(e);
    }
    const parts = [...byPart.keys()];
    let partIdx = 0;
    let guard = 0;
    while (selected.length < targetCount && guard < pool.length * parts.length + 1) {
      guard++;
      const part = parts[partIdx % parts.length];
      partIdx++;
      const queue = byPart.get(part);
      if (queue && queue.length > 0) {
        const e = queue.shift()!;
        if (!usedIds.has(e.id)) {
          selected.push(e);
          usedIds.add(e.id);
        }
      }
      if (parts.every((p) => (byPart.get(p)?.length ?? 0) === 0)) break;
    }
  }

  roundRobinFill(compounds, targetCount - selected.length);
  roundRobinFill(isolations, targetCount - selected.length);

  const exercises: GeneratedExercise[] = selected.map((exercise) => ({
    exercise,
    sets: scheme.sets,
    reps: scheme.reps,
    restSec: scheme.restSec,
  }));

  return {
    exercises,
    estimatedDurationMin: exercises.length * MINUTES_PER_EXERCISE,
  };
}
