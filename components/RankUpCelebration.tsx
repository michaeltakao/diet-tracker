'use client';

import { useEffect, useRef } from 'react';
import { getRankForXp, type RankId } from '@/lib/rank';
import { RankIcon } from '@/lib/rank-icons';
import ParticleBurst from './ParticleBurst';
import XpProgressBar from './XpProgressBar';
import { playRankUpSound } from '@/lib/rank-up-sound';
import { useLanguage } from '@/contexts/LanguageContext';

interface RankUpCelebrationProps {
  oldRank: RankId;
  newRank: RankId;
  xp: number;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 4000;

export default function RankUpCelebration({ oldRank, newRank, xp, onClose }: RankUpCelebrationProps) {
  const { t } = useLanguage();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = getRankForXp(xp);
  // The bar animates from the new rank's floor up to the actual XP — a
  // satisfying "just crossed the line" fill-in. We don't have the exact
  // pre-award XP here, so this is an approximation, not oldRank's own
  // threshold (which would show a jump spanning multiple rank-colors at once).
  const jumpFromXp = progress.currentThreshold;
  const oldRankName = t[`rankName${oldRank}` as keyof typeof t] as string;

  useEffect(() => {
    playRankUpSound();
    timerRef.current = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount; onClose identity churn should not restart the timer
  }, []);

  const rankName = t[`rankName${newRank}` as keyof typeof t] as string;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.rankUpTitle}
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10,10,15,0.75)' }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 pointer-events-none animate-rank-flash"
        style={{ background: 'radial-gradient(circle at 50% 50%, white 0%, transparent 60%)' }}
        aria-hidden="true"
      />

      <div className="relative w-full h-full" aria-hidden="true">
        <ParticleBurst />
      </div>

      <div
        className="system-panel absolute z-10 mx-6 max-w-xs w-full rounded-2xl p-8 text-center animate-badge-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <RankIcon
            icon={progress.icon}
            className="w-20 h-20"
            style={{ color: progress.color, filter: `drop-shadow(0 0 12px ${progress.color})` }}
          />
        </div>

        <p className="neon-text text-xs font-black uppercase tracking-widest mb-1">
          {t.rankUpTitle}
        </p>
        <h2 className="text-2xl font-black text-[var(--sys-text)] mb-1">
          {rankName}
        </h2>
        <p className="text-xs text-[var(--sys-text-muted)] mb-4">
          {oldRankName} → {rankName}
        </p>

        <XpProgressBar xp={xp} jumpFrom={jumpFromXp} />

        <p className="mt-5 text-sm text-[var(--sys-text)] font-bold">
          {t.rankUpCongrats}
        </p>

        <button
          onClick={onClose}
          autoFocus
          className="
            mt-5 w-full py-3
            system-border neon-glow
            text-[var(--sys-primary)] font-bold rounded-xl
            transition-all duration-200
            hover:brightness-125 active:scale-[0.97]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sys-primary)]
          "
          style={{ background: 'var(--sys-surface-2)' }}
        >
          {t.rankUpClose}
        </button>
      </div>
    </div>
  );
}
