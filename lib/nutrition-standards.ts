/**
 * Age-aware nutrition standards from 日本人の食事摂取基準（2025年版）.
 *
 * Source (Fact): 厚生労働省「日本人の食事摂取基準（2025年版）」策定検討会報告書
 * (2024). Values transcribed from the report's appendix tables:
 *   - 参考表 推定エネルギー必要量（kcal/日） — band × sex × 身体活動レベル
 *   - たんぱく質の食事摂取基準 推奨量（g/日）
 *   - 脂質の食事摂取基準 目標量 20–30 %エネルギー（全年齢帯）
 *   - 炭水化物の食事摂取基準 目標量 50–65 %エネルギー（全年齢帯）
 * Cross-checked 2026-07-09 against two independent transcriptions of the
 * report tables (建帛社 / 東京教学社 textbook appendices, both citing the
 * 報告書); all 12+ band values agree. Report index:
 * https://www.mhlw.go.jp/stf/newpage_44138.html
 *
 * Scope: ages 12+ only. Under-12 pediatric nutrition is out of scope —
 * every function returns null for age < 12 so callers fall back to the
 * app's existing defaults.
 *
 * Assumptions:
 *   - `sex` unset → mean of male/female table values (sex-averaged targets).
 *   - The app's 5-way ActivityLevel maps onto the 基準's 3-way 身体活動レベル
 *     (低い/ふつう/高い): sedentary→低い, lightly/moderately→ふつう,
 *     very/extra→高い.
 *   - 75+ has no 高い column in the 基準 (high-PAL not defined for 75+);
 *     we use the ふつう value for 高い there.
 *   - Fat target = 25 %E (midpoint of 20–30), carbs = 57.5 %E (midpoint of
 *     50–65), converted at 9 kcal/g and 4 kcal/g respectively.
 *   - Elderly (65+) protein floor 1.0 g/kg/day when weight is known —
 *     sarcopenia/frailty prevention. Contraindication-grade caps (e.g. CKD
 *     0.8 g/kg in lib/recommend-safety.ts) take precedence over this floor.
 */

import type { ActivityLevel, DailyGoals, UserHealthProfile } from '@/lib/types';

export type AgeBand = '12-14' | '15-17' | '18-29' | '30-49' | '50-64' | '65-74' | '75+';

export type Sex = 'male' | 'female';

/** 基準's 3-way 身体活動レベル index: 0=低い(I), 1=ふつう(II), 2=高い(III). */
type PalIndex = 0 | 1 | 2;

/** Elderly protein floor (g/kg/day) for sarcopenia/frailty prevention. */
export const SENIOR_PROTEIN_G_PER_KG = 1.0;

// ── Age banding ─────────────────────────────────────────────────────────────

/**
 * Map an age in years to a 食事摂取基準 age band.
 *
 * Returns null for age < 12, unset (null/undefined), or non-finite values —
 * callers fall back to current (age-agnostic) behavior.
 */
export function ageBand(age: number | null | undefined): AgeBand | null {
  if (age == null || !Number.isFinite(age) || age < 12) return null;
  if (age <= 14) return '12-14';
  if (age <= 17) return '15-17';
  if (age <= 29) return '18-29';
  if (age <= 49) return '30-49';
  if (age <= 64) return '50-64';
  if (age <= 74) return '65-74';
  return '75+';
}

/** Growth-phase user (12–17): calorie-deficit recommendations are forbidden. */
export function isMinor(age: number | null | undefined): boolean {
  const band = ageBand(age);
  return band === '12-14' || band === '15-17';
}

/** Senior user (65+): sarcopenia/frailty-prevention guardrails apply. */
export function isSenior(age: number | null | undefined): boolean {
  const band = ageBand(age);
  return band === '65-74' || band === '75+';
}

// ── 推定エネルギー必要量 (EER) ───────────────────────────────────────────────

/** EER (kcal/day) per band: [低い, ふつう, 高い] for male and female. */
const EER_TABLE: Record<AgeBand, { male: [number, number, number]; female: [number, number, number] }> = {
  '12-14': { male: [2300, 2600, 2900], female: [2150, 2400, 2700] },
  '15-17': { male: [2500, 2850, 3150], female: [2050, 2300, 2550] },
  '18-29': { male: [2250, 2600, 3000], female: [1700, 1950, 2250] },
  '30-49': { male: [2350, 2750, 3150], female: [1750, 2050, 2350] },
  '50-64': { male: [2250, 2650, 3000], female: [1700, 1950, 2250] },
  '65-74': { male: [2100, 2350, 2650], female: [1650, 1850, 2050] },
  // 75+ has no 高い column in the 基準; ふつう value reused for index 2.
  '75+':   { male: [1850, 2250, 2250], female: [1450, 1750, 1750] },
};

/** たんぱく質 推奨量 (g/day) per band. */
const PROTEIN_RDA_TABLE: Record<AgeBand, { male: number; female: number }> = {
  '12-14': { male: 60, female: 55 },
  '15-17': { male: 65, female: 55 },
  '18-29': { male: 65, female: 50 },
  '30-49': { male: 65, female: 50 },
  '50-64': { male: 65, female: 50 },
  '65-74': { male: 60, female: 50 },
  '75+':   { male: 60, female: 50 },
};

/** Map the app's 5-way ActivityLevel to the 基準's 3-way 身体活動レベル. */
function palIndex(activityLevel: ActivityLevel): PalIndex {
  switch (activityLevel) {
    case 'sedentary':         return 0;
    case 'lightly_active':
    case 'moderately_active': return 1;
    case 'very_active':
    case 'extra_active':      return 2;
  }
}

/**
 * 推定エネルギー必要量 (kcal/day) lookup.
 *
 * Parameters
 * ----------
 * age : years; ages < 12 (or unset) return null
 * sex : 'male' | 'female' | null — null averages the male/female values
 * activityLevel : the app's 5-way level, mapped to 低い/ふつう/高い
 *
 * Returns
 * -------
 * EER in kcal/day, or null when age is out of scope.
 */
export function estimatedEnergyRequirement(
  age: number | null | undefined,
  sex: Sex | null | undefined,
  activityLevel: ActivityLevel,
): number | null {
  const band = ageBand(age);
  if (!band) return null;
  const pal = palIndex(activityLevel);
  const row = EER_TABLE[band];
  if (sex === 'male' || sex === 'female') return row[sex][pal];
  return Math.round((row.male[pal] + row.female[pal]) / 2);
}

/** たんぱく質推奨量 (g/day); sex null → mean of male/female. Null when out of scope. */
export function proteinRda(
  age: number | null | undefined,
  sex: Sex | null | undefined,
): number | null {
  const band = ageBand(age);
  if (!band) return null;
  const row = PROTEIN_RDA_TABLE[band];
  if (sex === 'male' || sex === 'female') return row[sex];
  return Math.round((row.male + row.female) / 2);
}

// ── Recommended daily goals ─────────────────────────────────────────────────

/** %E targets: midpoints of the 基準's 目標量 ranges (fat 20–30, carbs 50–65). */
const FAT_PERCENT_ENERGY   = 25;
const CARB_PERCENT_ENERGY  = 57.5;
const KCAL_PER_G_FAT       = 9;
const KCAL_PER_G_CARB      = 4;

/** Default daily water goal (ml). The 基準 defines no RDA for water. */
const DEFAULT_WATER_ML = 2000;

/**
 * Age/sex/activity-appropriate daily goals from the 食事摂取基準.
 *
 * energy  = 推定エネルギー必要量 (never a deficit — minors especially)
 * protein = 推奨量; for 65+ raised to max(RDA, 1.0 g/kg) when weight is known
 * fat     = 25 %E ÷ 9 kcal/g
 * carbs   = 57.5 %E ÷ 4 kcal/g
 * water   = 2000 ml (unchanged; no 基準 RDA)
 *
 * Contraindication-grade caps (CKD protein ≤ 0.8 g/kg) are NOT applied here —
 * they live in lib/recommend-safety.ts and always win over the senior floor.
 *
 * Returns null when the profile's age is < 12 or unset.
 */
export function recommendedGoals(
  profile: Pick<UserHealthProfile, 'age' | 'sex' | 'activityLevel'>,
  weightKg: number | null,
): DailyGoals | null {
  const energy = estimatedEnergyRequirement(profile.age, profile.sex ?? null, profile.activityLevel);
  if (energy == null) return null;

  let protein = proteinRda(profile.age, profile.sex ?? null) ?? 0;
  if (isSenior(profile.age) && weightKg && weightKg > 0) {
    protein = Math.max(protein, Math.round(SENIOR_PROTEIN_G_PER_KG * weightKg));
  }

  const fat   = Math.round((energy * FAT_PERCENT_ENERGY  / 100) / KCAL_PER_G_FAT);
  const carbs = Math.round((energy * CARB_PERCENT_ENERGY / 100) / KCAL_PER_G_CARB);

  return { calories: energy, protein, fat, carbs, water: DEFAULT_WATER_ML };
}
