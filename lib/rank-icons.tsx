/**
 * Hand-drawn rank icon SVGs for the Solo Leveling rank system.
 * No icon library — geometric 24x24 viewBox paths, one per rank tier.
 */

import type { RankDef } from './rank';

export type RankIconKind = RankDef['icon'];

export const RANK_ICON_PATHS: Record<RankIconKind, string> = {
  // broken-sword (E): snapped blade, jagged break line
  'broken-sword':
    'M12 2 L13.2 9.5 L10.8 9.5 Z M10.5 11 L13.5 11 L13.1 15.5 L10.9 15.5 Z ' +
    'M11.3 17 L12.7 17 L12.9 19.5 L11.1 19.5 Z M8 19 L16 19 L16 20.5 L8 20.5 Z ' +
    'M9.5 21 L14.5 21 L14.5 22 L9.5 22 Z',
  // sword (D): straight blade + crossguard + hilt
  sword:
    'M12 1 L13 3 L12.6 15 L11.4 15 L11 3 Z M8.5 15.5 L15.5 15.5 L15.5 17 L8.5 17 Z ' +
    'M11.2 17.2 L12.8 17.2 L12.8 21.5 L11.2 21.5 Z M10 21.8 L14 21.8 L14 23 L10 23 Z',
  // dagger (C): short blade, small guard
  dagger:
    'M12 4 L12.8 6 L12.5 14 L11.5 14 L11.2 6 Z M9.5 14.3 L14.5 14.3 L14.5 15.5 L9.5 15.5 Z ' +
    'M11.3 15.7 L12.7 15.7 L12.7 19.5 L11.3 19.5 Z',
  // shield (B): heraldic shield outline
  shield:
    'M12 2 L19 5 L19 11.5 C19 16.5 15.8 19.8 12 21.5 C8.2 19.8 5 16.5 5 11.5 L5 5 Z ' +
    'M12 4.3 L17 6.5 L17 11.3 C17 15 14.8 17.6 12 19.1 C9.2 17.6 7 15 7 11.3 L7 6.5 Z',
  // spear (A): long shaft + leaf-shaped head
  spear:
    'M12 1 L14 5 L12.7 7.5 L11.3 7.5 L10 5 Z M11.4 7.8 L12.6 7.8 L12.6 22 L11.4 22 Z ' +
    'M9.3 12.5 L14.7 12.5 L14.7 13.3 L9.3 13.3 Z',
  // crown (S): five-point crown
  crown:
    'M4 9 L7.5 12 L10 6 L12 9.5 L14 6 L16.5 12 L20 9 L18.5 18 L5.5 18 Z ' +
    'M5.5 19 L18.5 19 L18.5 20.5 L5.5 20.5 Z',
};

interface RankIconProps {
  icon: RankIconKind;
  className?: string;
  style?: React.CSSProperties;
}

export function RankIcon({ icon, className, style }: RankIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={RANK_ICON_PATHS[icon]} />
    </svg>
  );
}
