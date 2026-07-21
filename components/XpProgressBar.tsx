'use client';

import { useEffect, useState } from 'react';
import { getRankForXp } from '@/lib/rank';
import { useLanguage } from '@/contexts/LanguageContext';

interface XpProgressBarProps {
  xp: number;
  /**
   * Previous XP value to animate FROM (Phase 4 rank-up celebration replay).
   * When omitted, the bar renders at its resting `xp` position immediately —
   * normal Phase 2/3 display, no animated "jump".
   */
  jumpFrom?: number;
}

export default function XpProgressBar({ xp, jumpFrom }: XpProgressBarProps) {
  const { t } = useLanguage();
  const progress = getRankForXp(xp);

  // When jumpFrom is provided, render at the OLD value on first paint, then
  // animate to the real value on the next tick (transition-all picks it up).
  // No jumpFrom → displayXp tracks xp directly, no animation state needed.
  const [displayXp, setDisplayXp] = useState(jumpFrom ?? xp);
  useEffect(() => {
    if (jumpFrom == null) return;
    const id = requestAnimationFrame(() => setDisplayXp(xp));
    return () => cancelAnimationFrame(id);
  }, [xp, jumpFrom]);
  const effectiveDisplayXp = jumpFrom == null ? xp : displayXp;

  const displayProgress = getRankForXp(effectiveDisplayXp);
  const span = displayProgress.nextThreshold != null
    ? displayProgress.nextThreshold - displayProgress.currentThreshold
    : 1;
  const filled = displayProgress.nextThreshold != null
    ? Math.min(1, Math.max(0, (effectiveDisplayXp - displayProgress.currentThreshold) / span))
    : 1;

  const nextRankName = progress.nextRank
    ? (t[`rankName${progress.nextRank}` as keyof typeof t] as string)
    : null;

  return (
    <div>
      <div
        className="relative h-2.5 rounded-full overflow-hidden system-border"
        style={{ background: 'var(--sys-surface-2)' }}
      >
        <div className="system-scanline-overlay absolute inset-0 pointer-events-none" aria-hidden="true" />
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative z-10"
          style={{
            width: `${filled * 100}%`,
            background: `linear-gradient(90deg, ${displayProgress.color}, ${progress.nextThreshold != null ? `var(--rank-${(progress.nextRank ?? progress.rank).toLowerCase()})` : progress.color})`,
          }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-[var(--sys-text-muted)]">
        {progress.nextThreshold != null
          ? `${t.statusBarXpLabel
              .replace('{n}', xp.toLocaleString())
              .replace('{total}', progress.nextThreshold.toLocaleString())} · ${t.statusBarNextRank.replace('{rank}', nextRankName ?? '')}`
          : t.statusBarMaxRank.replace('{n}', xp.toLocaleString())}
      </p>
    </div>
  );
}
