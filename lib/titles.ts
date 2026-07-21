/**
 * Solo Leveling title system — 11 titles: 5 milestone titles (streak/meal/
 * workout/water counts) + 6 rank-gated "shadow" titles (E through S).
 *
 * shadow_rookie is earned at E-rank, which is the XP-0 starting state —
 * every user has it from the moment they open the app (see evaluateTitles:
 * rankAtLeast(highestRank, 'E') is trivially true for all RankId values).
 * This is intentional per the design brief, not a bug: everyone starts as
 * a "shadow rookie".
 */

import { getWriteContext } from './data/_write';
import { getAppData, saveAppData } from './storage';
import { rankAtLeast, type RankId } from './rank';

export type TitleKey =
  | 'unbroken'
  | 'iron_will'
  | 'nutrition_master'
  | 'workout_warrior'
  | 'hydration_hero'
  | 'shadow_rookie'
  | 'shadow_veteran'
  | 'shadow_knight'
  | 'shadow_lord'
  | 'shadow_king'
  | 'shadow_emperor';

export interface TitleDef {
  key: TitleKey;
  /** i18n key name for the display name (titleNameX) */
  nameKey: string;
  /** i18n key name for the flavor description (titleDescX) */
  descKey: string;
  /** Rank required for shadow_* titles; undefined for milestone titles. */
  requiredRank?: RankId;
}

export const TITLES: TitleDef[] = [
  { key: 'unbroken',          nameKey: 'titleNameUnbroken',         descKey: 'titleDescUnbroken' },
  { key: 'iron_will',         nameKey: 'titleNameIronWill',         descKey: 'titleDescIronWill' },
  { key: 'nutrition_master',  nameKey: 'titleNameNutritionMaster',  descKey: 'titleDescNutritionMaster' },
  { key: 'workout_warrior',   nameKey: 'titleNameWorkoutWarrior',   descKey: 'titleDescWorkoutWarrior' },
  { key: 'hydration_hero',    nameKey: 'titleNameHydrationHero',    descKey: 'titleDescHydrationHero' },
  { key: 'shadow_rookie',     nameKey: 'titleNameShadowRookie',     descKey: 'titleDescShadowRookie',   requiredRank: 'E' },
  { key: 'shadow_veteran',    nameKey: 'titleNameShadowVeteran',    descKey: 'titleDescShadowVeteran',  requiredRank: 'D' },
  { key: 'shadow_knight',     nameKey: 'titleNameShadowKnight',     descKey: 'titleDescShadowKnight',   requiredRank: 'C' },
  { key: 'shadow_lord',       nameKey: 'titleNameShadowLord',       descKey: 'titleDescShadowLord',     requiredRank: 'B' },
  { key: 'shadow_king',       nameKey: 'titleNameShadowKing',       descKey: 'titleDescShadowKing',     requiredRank: 'A' },
  { key: 'shadow_emperor',    nameKey: 'titleNameShadowEmperor',    descKey: 'titleDescShadowEmperor',  requiredRank: 'S' },
];

export interface TitleEvalContext {
  streak: number;
  longestStreak: number;
  mealCount: number;
  workoutCount: number;
  waterLogDayCount: number;
  highestRank: RankId;
}

/** Milestone thresholds for the 5 non-rank titles. */
const UNBROKEN_STREAK_DAYS = 30;
const IRON_WILL_LONGEST_STREAK_DAYS = 100;
const NUTRITION_MASTER_MEAL_COUNT = 100;
const WORKOUT_WARRIOR_WORKOUT_COUNT = 50;
const HYDRATION_HERO_WATER_DAYS = 30;

function isEarned(def: TitleDef, ctx: TitleEvalContext): boolean {
  switch (def.key) {
    case 'unbroken':         return ctx.streak >= UNBROKEN_STREAK_DAYS;
    case 'iron_will':        return ctx.longestStreak >= IRON_WILL_LONGEST_STREAK_DAYS;
    case 'nutrition_master': return ctx.mealCount >= NUTRITION_MASTER_MEAL_COUNT;
    case 'workout_warrior':  return ctx.workoutCount >= WORKOUT_WARRIOR_WORKOUT_COUNT;
    case 'hydration_hero':   return ctx.waterLogDayCount >= HYDRATION_HERO_WATER_DAYS;
    default:
      return def.requiredRank != null && rankAtLeast(ctx.highestRank, def.requiredRank);
  }
}

/** Titles newly earned given `ctx`, excluding any already in `alreadyEarned`. */
export function evaluateTitles(ctx: TitleEvalContext, alreadyEarned: Set<TitleKey>): TitleDef[] {
  return TITLES.filter((def) => !alreadyEarned.has(def.key) && isEarned(def, ctx));
}

/**
 * Award a title (idempotent — localStorage-first, then Supabase dual-write).
 * @returns true if this was a new award, false if already held.
 */
export async function awardTitle(userId: string | null, titleKey: TitleKey): Promise<boolean> {
  void userId; // kept for interface symmetry with addXp/recordQuestCompletion; auth resolved via getWriteContext()

  const data = getAppData();
  const held = new Set(data.earnedTitles ?? []);
  if (held.has(titleKey)) return false;

  held.add(titleKey);
  data.earnedTitles = Array.from(held);
  saveAppData(data);

  const ctx = await getWriteContext();
  if (ctx) {
    const def = TITLES.find((t) => t.key === titleKey);
    const { error } = await ctx.supabase.from('user_titles').upsert(
      {
        user_id: ctx.userId,
        title_key: titleKey,
        display_name: def?.nameKey ?? titleKey,
        awarded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,title_key' },
    );
    if (error) {
      console.warn('[titles] Supabase awardTitle failed:', error.message);
    }
  }

  return true;
}
