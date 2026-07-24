'use client';

import { getExerciseRankState } from '@/lib/data/exercise-rank';
import { EXERCISE_RANK_TIERS } from '@/lib/exercise-rank';
import { ExerciseRankIcon } from '@/lib/exercise-rank-icons';
import { useLanguage } from '@/contexts/LanguageContext';

interface ExerciseRankBadgeProps {
  exerciseId: string;
  size?: 'sm' | 'md';
}

const SIZE_MAP = {
  sm: { box: 22, icon: 12 },
  md: { box: 32, icon: 18 },
};

/**
 * Small rank-tier badge for an exercise, shown next to the 🏆 PR pill.
 * Renders nothing when the exercise has no achieved tier yet (unranked —
 * no bodyweight logged, or hasn't crossed the novice floor) — an absent
 * badge, not an empty placeholder, matches how PR pills only show once a
 * PR exists.
 */
export default function ExerciseRankBadge({ exerciseId, size = 'sm' }: ExerciseRankBadgeProps) {
  const { t } = useLanguage();
  const state = getExerciseRankState(exerciseId);
  if (!state) return null;

  const tier = EXERCISE_RANK_TIERS[state.rank];
  const dims = SIZE_MAP[size];
  const nameKey = `exerciseRankName${state.rank.charAt(0).toUpperCase()}${state.rank.slice(1)}` as keyof typeof t;
  const rankName = t[nameKey] as string;

  return (
    <span
      title={rankName}
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: dims.box,
        height: dims.box,
        background: `color-mix(in srgb, var(${tier.colorVar}) 22%, transparent)`,
        boxShadow: `0 0 6px color-mix(in srgb, var(${tier.colorVar}) 55%, transparent)`,
      }}
    >
      <ExerciseRankIcon
        icon={tier.icon}
        style={{ width: dims.icon, height: dims.icon, color: `var(${tier.colorVar})` }}
      />
    </span>
  );
}
