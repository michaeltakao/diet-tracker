'use client';

import { useEffect, useRef } from 'react';
import { EXERCISE_RANK_TIERS, type ExerciseRankId } from '@/lib/exercise-rank';
import { ExerciseRankIcon } from '@/lib/exercise-rank-icons';
import ParticleBurst from './ParticleBurst';
import { playRankUpSound } from '@/lib/rank-up-sound';
import { useLanguage } from '@/contexts/LanguageContext';

interface ExerciseRankUpCelebrationProps {
  exerciseName: string; // display name (nameJa/nameEn), for the congrats copy
  newRank: Exclude<ExerciseRankId, 'unranked'>;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 4000;

/**
 * Per-exercise rank-up celebration — visual/interaction pattern modeled on
 * RankUpCelebration.tsx (icon + particle burst + sound + auto-close), but
 * using the distinct Novice→Elite ladder (lib/exercise-rank.ts), never the
 * account-wide XP ranks. Intentionally simpler than RankUpCelebration (no
 * XP progress bar — this ladder has no numeric XP to animate).
 */
export default function ExerciseRankUpCelebration({ exerciseName, newRank, onClose }: ExerciseRankUpCelebrationProps) {
  const { t } = useLanguage();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tier = EXERCISE_RANK_TIERS[newRank];
  const nameKey = `exerciseRankName${newRank.charAt(0).toUpperCase()}${newRank.slice(1)}` as keyof typeof t;
  const rankName = t[nameKey] as string;

  useEffect(() => {
    playRankUpSound();
    timerRef.current = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount; onClose identity churn should not restart the timer
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.exerciseRankUpTitle}
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
          <ExerciseRankIcon
            icon={tier.icon}
            className="w-16 h-16"
            style={{ color: `var(${tier.colorVar})`, filter: `drop-shadow(0 0 12px var(${tier.colorVar}))` }}
          />
        </div>

        <p className="neon-text text-xs font-black uppercase tracking-widest mb-1">
          {t.exerciseRankUpTitle}
        </p>
        <h2 className="text-2xl font-black text-[var(--sys-text)] mb-1">
          {exerciseName}
        </h2>
        <p className="text-sm text-[var(--sys-text-muted)] mb-5" style={{ color: `var(${tier.colorVar})` }}>
          {rankName}
        </p>

        <p className="text-sm text-[var(--sys-text)] font-bold">
          {t.exerciseRankUpCongrats.replace('{exercise}', exerciseName)}
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
