/**
 * Sodium/fiber day aggregation and 厚労省 comparison targets — pure functions.
 *
 * Scope is deliberately sodium + fiber only (2026-07-17 decision): most
 * entries carry no micronutrient data, so a fuller vitamin/mineral panel
 * would mostly false-alarm "deficiencies" from missing data — conflicting
 * with the app's non-diagnostic stance. Sums are computed over entries WITH
 * data and displayed only when at least one such entry exists.
 *
 * Targets (Fact — 日本人の食事摂取基準, 目標量, adults):
 *   食塩相当量  < 7.5 g/day (male), < 6.5 g/day (female)
 *   食物繊維   ≥ 21 g/day (male),  ≥ 18 g/day (female)
 * Sex unset → mean of the two, matching lib/nutrition-standards.ts.
 */

export interface SodiumFiberSummary {
  /** Total sodium (mg) over entries that carry sodium data. */
  sodiumMg: number;
  /** Total dietary fiber (g) over entries that carry fiber data. */
  fiberG: number;
  /** Entries carrying at least one of sodium/fiber — 0 ⇒ hide the display. */
  entriesWithData: number;
}

type Sex = 'male' | 'female' | null | undefined;

const SALT_TARGET_G = { male: 7.5, female: 6.5 } as const;
const FIBER_TARGET_G = { male: 21, female: 18 } as const;

/** Grams of salt (食塩相当量) per gram of sodium. */
const SALT_PER_SODIUM = 2.54;

const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Sodium mg → 食塩相当量 g (1 decimal), the unit 厚労省 targets use. */
export function sodiumMgToSaltG(sodiumMg: number): number {
  return round1((sodiumMg * SALT_PER_SODIUM) / 1000);
}

/** 食塩相当量 target (g/day, upper limit); sex unset → mean. */
export function saltTargetG(sex: Sex): number {
  if (sex === 'male' || sex === 'female') return SALT_TARGET_G[sex];
  return round1((SALT_TARGET_G.male + SALT_TARGET_G.female) / 2);
}

/** 食物繊維 target (g/day, lower bound); sex unset → mean. */
export function fiberTargetG(sex: Sex): number {
  if (sex === 'male' || sex === 'female') return FIBER_TARGET_G[sex];
  return round1((FIBER_TARGET_G.male + FIBER_TARGET_G.female) / 2);
}

/**
 * Sum sodium/fiber over a day's entries.
 *
 * Parameters
 * ----------
 * entries : array of objects with optional sodiumMg / fiberG (FoodEntry-shaped).
 *
 * Returns
 * -------
 * SodiumFiberSummary — sums over entries with data; callers must treat the
 * sums as a lower bound (entries without data contribute nothing) and hide
 * the display entirely when entriesWithData is 0.
 */
export function sumSodiumFiber(
  entries: ReadonlyArray<{ sodiumMg?: number; fiberG?: number }>,
): SodiumFiberSummary {
  let sodiumMg = 0;
  let fiberG = 0;
  let entriesWithData = 0;
  for (const e of entries) {
    const hasSodium = typeof e.sodiumMg === 'number' && Number.isFinite(e.sodiumMg);
    const hasFiber = typeof e.fiberG === 'number' && Number.isFinite(e.fiberG);
    if (hasSodium) sodiumMg += e.sodiumMg as number;
    if (hasFiber) fiberG += e.fiberG as number;
    if (hasSodium || hasFiber) entriesWithData++;
  }
  return { sodiumMg: Math.round(sodiumMg), fiberG: round1(fiberG), entriesWithData };
}
