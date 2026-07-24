/**
 * Hand-drawn rank icon SVGs for the per-exercise strength rank system.
 * No icon library — geometric 24x24 viewBox paths, one per tier. Deliberately
 * distinct icon set from lib/rank-icons.tsx's sword/shield ladder.
 */

import type { ExerciseRankTierDef } from './exercise-rank';

export type ExerciseRankIconKind = ExerciseRankTierDef['icon'];

export const EXERCISE_RANK_ICON_PATHS: Record<ExerciseRankIconKind, string> = {
  // feather (novice): simple quill shape
  feather:
    'M17 3 C13 5 9 9 7 15 C6.3 17 6 19 6 21 L7.5 21 C7.7 19.3 8.2 17.5 9 15.7 ' +
    'C11 11 14.5 7 18 4.5 Z M8.5 16.5 L11.5 14 M9.5 14 L12.5 11.5 M10.7 11.3 L13.5 9',
  // weight (intermediate): dumbbell silhouette
  weight:
    'M4 10 L4 14 L6 14 L6 10 Z M18 10 L18 14 L20 14 L20 10 Z ' +
    'M7 9 L7 15 L8.5 15 L8.5 9 Z M15.5 9 L15.5 15 L17 15 L17 9 Z ' +
    'M8.5 11.2 L15.5 11.2 L15.5 12.8 L8.5 12.8 Z',
  // flame (advanced): rising flame
  flame:
    'M12 2 C10 6 7 8 7 12.5 C7 16.6 9.7 19.5 12 19.5 C14.3 19.5 17 16.6 17 12.5 ' +
    'C17 10.5 16.2 9 15.3 7.8 C15.5 9.3 14.8 10.5 13.8 11 C14 8.5 13 5.5 12 2 Z ' +
    'M12 9 C11 11.5 10 12.8 10 14.5 C10 16.2 10.9 17.3 12 17.3 C13.1 17.3 14 16.2 14 14.5 ' +
    'C14 13.3 13.4 12.4 12.8 11.7 C12.7 12.5 12.3 13 11.8 13.2 C11.9 11.7 12.3 10.3 12 9 Z',
  // bolt (expert): lightning bolt
  bolt:
    'M13.5 1.5 L5 13.5 L10.5 13.5 L9 22.5 L19 10 L13 10 Z',
  // star (elite): five-point star
  star:
    'M12 1.5 L14.8 8.6 L22.5 9.1 L16.5 14 L18.5 21.5 L12 17.3 L5.5 21.5 L7.5 14 ' +
    'L1.5 9.1 L9.2 8.6 Z',
};

interface ExerciseRankIconProps {
  icon: ExerciseRankIconKind;
  className?: string;
  style?: React.CSSProperties;
}

export function ExerciseRankIcon({ icon, className, style }: ExerciseRankIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={EXERCISE_RANK_ICON_PATHS[icon]} />
    </svg>
  );
}
