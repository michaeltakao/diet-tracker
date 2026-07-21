'use client';

import { getRankForXp } from '@/lib/rank';
import { RankIcon } from '@/lib/rank-icons';
import { useLanguage } from '@/contexts/LanguageContext';

interface RankBadgeProps {
  xp: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { hex: 56,  icon: 22, text: 'text-[9px]' },
  md: { hex: 88,  icon: 34, text: 'text-[11px]' },
  lg: { hex: 128, icon: 48, text: 'text-sm' },
};

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

export default function RankBadge({ xp, size = 'md' }: RankBadgeProps) {
  const { t } = useLanguage();
  const progress = getRankForXp(xp);
  const dims = SIZE_MAP[size];
  const rankName = t[`rankName${progress.rank}` as keyof typeof t] as string;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex items-center justify-center"
        style={{
          width: dims.hex,
          height: dims.hex,
          clipPath: HEX_CLIP,
          background: `linear-gradient(135deg, var(--sys-surface-2), ${progress.color})`,
          boxShadow: `0 0 12px var(--sys-primary-glow)`,
        }}
      >
        <RankIcon
          icon={progress.icon}
          className="text-[var(--sys-text)]"
          style={{ width: dims.icon, height: dims.icon }}
        />
      </div>
      <span className={`neon-text font-black tracking-[0.15em] uppercase ${dims.text}`}>
        {rankName}
      </span>
    </div>
  );
}
