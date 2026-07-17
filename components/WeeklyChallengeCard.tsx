'use client';

import { useEffect, useState } from 'react';
import {
  getCurrentWeeklyChallenge,
  syncWeeklyChallenge,
  type WeeklyChallenge,
} from '@/lib/data';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProgressBar } from '@/components/ui/ProgressBar';

/** "07/13 – 07/19" from the challenge's JST week bounds. */
function weekLabel(c: WeeklyChallenge): string {
  const fmt = (d: string) => d.slice(5).replace('-', '/');
  return `${fmt(c.weekStart)} – ${fmt(c.weekEnd)}`;
}

/**
 * Fixed weekly challenge card: "log activity on N distinct days this week"
 * with a progress bar (JST Mon–Sun week). Activity-based, so it renders in
 * both goal states (P0 #4a pattern) — no goal targets involved.
 */
export default function WeeklyChallengeCard() {
  const { t } = useLanguage();
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setChallenge(getCurrentWeeklyChallenge());
    void syncWeeklyChallenge(); // best-effort research mirror (no-op for guests)
  }, []);

  if (!challenge) return null;

  return (
    <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-muted">🎯 {t.weeklyChallengeTitle}</h2>
        <span className="text-[10px] font-semibold text-faint tabular-nums">
          {weekLabel(challenge)}
        </span>
      </div>

      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-muted">{t.weeklyChallengeGoal}</span>
        <span className="text-sm font-bold text-fg tabular-nums">
          {challenge.progressDays}
          <span className="font-normal text-faint"> / {challenge.goalDays}{t.streakDays}</span>
        </span>
      </div>

      <ProgressBar
        value={challenge.progressDays}
        max={challenge.goalDays}
        label={`${challenge.progressDays}/${challenge.goalDays}${t.streakDays}`}
      />

      {challenge.completed && (
        <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1.5 text-right animate-slide-in-up">
          {t.weeklyChallengeDone}
        </p>
      )}
    </div>
  );
}
