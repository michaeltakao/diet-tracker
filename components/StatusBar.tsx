'use client';

import { getRankForXp, type RankId } from '@/lib/rank';
import { RankIcon } from '@/lib/rank-icons';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatusBarProps {
  xp: number;
  highestRank: RankId;
}

/**
 * Compact always-visible XP/rank strip. Takes xp/highestRank as props from
 * the parent's already-hydration-safe state (HomePage's loadData() →
 * getAppData(), same source RankBadge/XpProgressBar use) rather than
 * reading localStorage directly — a direct read here would render 0/E on
 * the server and the real value on the client, causing a hydration
 * mismatch on first paint.
 */
export default function StatusBar({ xp, highestRank }: StatusBarProps) {
  const { t } = useLanguage();
  const totalXp = xp;
  const progress = getRankForXp(totalXp);
  const rankName = t[`rankName${progress.rank}` as keyof typeof t] as string;

  return (
    <div className="system-panel flex items-center gap-3 px-4 py-2.5 rounded-xl">
      <RankIcon icon={progress.icon} className="w-6 h-6" style={{ color: progress.color }} />
      <div className="flex-1 min-w-0">
        <div className="neon-text text-xs font-black uppercase tracking-widest">
          {rankName}
        </div>
        <div className="text-[11px] text-[var(--sys-text-muted)]">
          {progress.nextThreshold != null
            ? t.statusBarXpLabel
                .replace('{n}', totalXp.toLocaleString())
                .replace('{total}', progress.nextThreshold.toLocaleString())
            : t.statusBarMaxRank.replace('{n}', totalXp.toLocaleString())}
        </div>
      </div>
      {highestRank !== progress.rank && (
        <div className="text-[10px] text-[var(--sys-text-muted)] shrink-0">
          {t.statusBarHighest.replace('{rank}', t[`rankName${highestRank}` as keyof typeof t] as string)}
        </div>
      )}
    </div>
  );
}
