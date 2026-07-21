/**
 * Solo Leveling XP primitive — localStorage read + dual-write to Supabase.
 *
 * XP is granted ONLY by daily-quest completion (lib/daily-quests.ts, Phase 3).
 * This module is the low-level primitive; nothing calls addXp() until Phase 3
 * wires quest evaluation in, so in Phase 1 every user simply starts and stays
 * at 0/500 E-rank — an honest empty state, not a bug.
 *
 * Same idiom as lib/data/badges.ts / lib/data/weight.ts: localStorage first
 * (synchronous, always succeeds), then Supabase fire-and-forget when
 * authenticated.
 */

import { getAppData, saveAppData } from './storage';
import { getWriteContext } from './data/_write';
import { rankAtLeast, type RankId } from './rank';
import { getRankForXp } from './rank';

export type XpAction =
  | 'quest_meal'
  | 'quest_workout'
  | 'quest_water'
  | 'quest_weight'
  | 'quest_all_complete';

export interface XpState {
  totalXp: number;
  highestRank: RankId;
}

/** Current XP + highest-ever rank, read synchronously from localStorage. */
export function getXpState(): XpState {
  const data = getAppData();
  return { totalXp: data.xp, highestRank: data.highestRank };
}

/**
 * Grant `amount` XP for `action`. Updates localStorage synchronously, then
 * ratchets `highestRank` to the max of its current value and the rank implied
 * by the new XP total (XP/rank never decreases — mirrors hasBadge()'s
 * once-earned-never-revoked semantics). Dual-writes to Supabase
 * `user_ranks` when authenticated (fire-and-forget; localStorage write has
 * already succeeded regardless).
 *
 * `userId` is accepted for interface symmetry with other quest/XP call
 * sites but is NOT used to gate the Supabase leg — auth is always
 * re-resolved via getWriteContext() (same as every other lib/data/*.ts
 * dual-write function), so passing `null` here never silently skips a
 * write for an actually-authenticated user.
 */
export async function addXp(
  userId: string | null,
  action: XpAction,
  amount: number,
): Promise<XpState> {
  void userId;  // see doc comment — real auth check is getWriteContext() below
  void action; // reserved for future per-action analytics; not persisted per-event today

  const data = getAppData();
  const newXp = Math.max(0, data.xp) + Math.max(0, amount);
  const impliedRank = getRankForXp(newXp).rank;
  const newHighest = rankAtLeast(impliedRank, data.highestRank) ? impliedRank : data.highestRank;

  data.xp = newXp;
  data.highestRank = newHighest;
  saveAppData(data);

  const state: XpState = { totalXp: newXp, highestRank: newHighest };

  const ctx = await getWriteContext();
  if (!ctx) return state;

  const { error } = await ctx.supabase.from('user_ranks').upsert(
    {
      user_id: ctx.userId,
      total_xp: newXp,
      highest_rank: newHighest,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    console.warn('[xp] Supabase addXp failed:', error.message);
  }

  return state;
}
