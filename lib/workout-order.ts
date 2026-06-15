/**
 * Pure helpers for the tap-to-select workout logger.
 *
 * Kept free of React, DOM, and `Date.now()` so they are deterministic and unit
 * testable. The workout page wires them to live state.
 */

/** Minimal view of a logged session needed to rank exercises by recency. */
export interface ExerciseHistoryItem {
  /** Exercise name; matched against the catalog entry's `name`. */
  name: string;
  /** Session date as `YYYY-MM-DD` (lexically sortable). */
  date: string;
}

/** Last completed session for one exercise (weight in kg). */
export interface LastSession {
  weight: number;
  reps: number;
  sets: number;
}

/** Initial set values to prefill the steppers (weight in kg). */
export interface InitialSetValues {
  weight: number;
  reps: number;
  sets: number;
}

/**
 * Order a catalog so exercises the user has trained come first, most-recent
 * first, with the untrained remainder following in catalog order.
 *
 * @typeParam T - Any object carrying a `name`; the element type is preserved.
 * @param catalog - Exercises for one muscle part, in catalog (display) order.
 *                  Assumed to have unique `name`s (enforced by the catalog test).
 * @param history - Logged sessions (any part); entries whose `name` is absent
 *                  from `catalog` are ignored. Multiple entries per name collapse
 *                  to the most recent `date`.
 * @returns A new array — a permutation of `catalog`. Input arrays are not mutated.
 *
 * @remarks Stable: trained exercises sharing a `date` keep catalog order, as does
 * the untrained tail. Complexity O(H + N log N) for H history items, N catalog
 * entries.
 */
export function orderByRecency<T extends { name: string }>(
  catalog: readonly T[],
  history: readonly ExerciseHistoryItem[],
): T[] {
  // Collapse history to the latest date per exercise name.
  const lastDate = new Map<string, string>();
  for (const h of history) {
    const prev = lastDate.get(h.name);
    if (prev === undefined || h.date > prev) lastDate.set(h.name, h.date);
  }

  const trained: { item: T; date: string; idx: number }[] = [];
  const untrained: T[] = [];
  catalog.forEach((item, idx) => {
    const date = lastDate.get(item.name);
    if (date !== undefined) trained.push({ item, date, idx });
    else untrained.push(item);
  });

  // Most-recent first; ties broken by original catalog order (stable).
  trained.sort((a, b) => (a.date === b.date ? a.idx - b.idx : b.date.localeCompare(a.date)));

  return [...trained.map((t) => t.item), ...untrained];
}

/**
 * Progressive-overload weight suggestion.
 *
 * If the last session reached ≥ 12 reps, add 2.5 kg; otherwise repeat the load.
 * Falls back to `defaultWeight` when there is no usable history (no last session
 * or a bodyweight/zero-load entry).
 *
 * @param last - Last session, or null when none exists.
 * @param defaultWeight - Catalog fallback load in kg.
 * @returns Suggested load in kg.
 */
export function suggestWeight(
  last: { weight: number; reps: number } | null,
  defaultWeight: number,
): number {
  if (!last || last.weight === 0) return defaultWeight;
  return last.reps >= 12 ? last.weight + 2.5 : last.weight;
}

/**
 * Resolve the values used to prefill the set editor for an exercise.
 *
 * Weight follows progressive overload (see {@link suggestWeight}); reps and sets
 * repeat the last session, falling back to the catalog defaults when there is no
 * history.
 *
 * @param def - Catalog defaults for the exercise.
 * @param last - Last completed session, or null.
 * @returns Prefill values (weight in kg).
 */
export function resolveInitialSetValues(
  def: { defaultWeight: number; defaultReps: number; defaultSets: number },
  last: LastSession | null,
): InitialSetValues {
  return {
    weight: suggestWeight(last, def.defaultWeight),
    reps: last?.reps ?? def.defaultReps,
    sets: last?.sets ?? def.defaultSets,
  };
}
