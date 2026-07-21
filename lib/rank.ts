/**
 * Solo Leveling-style rank system — pure XP → rank math.
 *
 * Six ranks (E through S), XP-threshold gated, lower bound inclusive:
 * xp===500 is D, xp===499 is E. No upper cap on S — beyond the S threshold,
 * `nextRank`/`nextThreshold` are null ("MAX RANK").
 */

export type RankId = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface RankDef {
  rank: RankId;
  threshold: number;
  colorVar: string;
  icon: 'broken-sword' | 'sword' | 'dagger' | 'shield' | 'spear' | 'crown';
  metalName: string;
}

export const RANKS: RankDef[] = [
  { rank: 'E', threshold: 0,     colorVar: '--rank-e', icon: 'broken-sword', metalName: 'Iron' },
  { rank: 'D', threshold: 500,   colorVar: '--rank-d', icon: 'sword',        metalName: 'Bronze' },
  { rank: 'C', threshold: 1500,  colorVar: '--rank-c', icon: 'dagger',       metalName: 'Silver' },
  { rank: 'B', threshold: 4000,  colorVar: '--rank-b', icon: 'shield',       metalName: 'Gold' },
  { rank: 'A', threshold: 8000,  colorVar: '--rank-a', icon: 'spear',        metalName: 'Platinum' },
  { rank: 'S', threshold: 15000, colorVar: '--rank-s', icon: 'crown',        metalName: 'Diamond' },
];

export interface RankProgress {
  rank: RankId;
  nextRank: RankId | null;
  currentThreshold: number;
  nextThreshold: number | null;
  color: string;
  icon: RankDef['icon'];
  /** i18n key name for the rank's flavor description (rankDescE..rankDescS) */
  description: string;
}

/**
 * Resolve XP to a rank + progress toward the next rank.
 *
 * @param xp - total accumulated XP. Negative/NaN inputs are clamped to 0
 *   (defensive — addXp() never produces these, but display code should not
 *   crash on a corrupted localStorage blob).
 */
export function getRankForXp(xp: number): RankProgress {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;

  let current = RANKS[0];
  for (const def of RANKS) {
    if (safeXp >= def.threshold) current = def;
    else break;
  }

  const currentIndex = RANKS.indexOf(current);
  const next = RANKS[currentIndex + 1] ?? null;

  return {
    rank: current.rank,
    nextRank: next?.rank ?? null,
    currentThreshold: current.threshold,
    nextThreshold: next?.threshold ?? null,
    color: `var(${current.colorVar})`,
    icon: current.icon,
    description: `rankDesc${current.rank}`,
  };
}

const RANK_ORDER: Record<RankId, number> = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

/** True when `rank` is at or above `min` in E→S ordering. */
export function rankAtLeast(rank: RankId, min: RankId): boolean {
  return RANK_ORDER[rank] >= RANK_ORDER[min];
}
