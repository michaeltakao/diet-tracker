'use client';

import { useEffect, useState } from 'react';
import { getAppData } from '@/lib/data';
import {
  DAILY_CHALLENGE_XP,
  getDailyChallengeProgress,
  type ChallengeType,
  type DailyChallengeProgress,
} from '@/lib/daily-challenge';
import { isChallengeCompletedToday, recordChallengeCompletion } from '@/lib/data/daily-challenge';
import { useLanguage } from '@/contexts/LanguageContext';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { jstToday } from '@/lib/streak';

const NAME_KEY: Record<
  ChallengeType,
  | 'dailyChallengeNamePushup100'
  | 'dailyChallengeNameSquat150'
  | 'dailyChallengeNamePlank180'
  | 'dailyChallengeNameLunge80'
  | 'dailyChallengeNameBurpee50'
  | 'dailyChallengeNameMountain60'
> = {
  pushup_100: 'dailyChallengeNamePushup100',
  squat_150: 'dailyChallengeNameSquat150',
  plank_180: 'dailyChallengeNamePlank180',
  lunge_80: 'dailyChallengeNameLunge80',
  burpee_50: 'dailyChallengeNameBurpee50',
  mountain_60: 'dailyChallengeNameMountain60',
};

/**
 * Shadow Training Grounds card: one deterministic bodyweight challenge per
 * JST day (lib/daily-challenge.ts), +30 XP on completion. Activity-based —
 * renders in both goal states, same as WeeklyChallengeCard.
 */
export default function DailyChallengeCard() {
  const { t } = useLanguage();
  const [progress, setProgress] = useState<DailyChallengeProgress | null>(null);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    // JST edge (accepted): challenge date is jstToday() but workout entries
    // carry the page's UTC date — 00:00–09:00 JST logs won't count here.
    const date = jstToday();
    const p = getDailyChallengeProgress(getAppData().workoutEntries, date);
    const done = isChallengeCompletedToday(date);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setProgress(p);
    setRecorded(done);
    // Mount-time reconciliation (WeeklyChallengeCard idiom): completion paths
    // that bypass the workout page still get recorded + awarded here.
    if (p.completed && !done && !isChallengeCompletedToday(date)) {
      setRecorded(true);
      void recordChallengeCompletion(null, date, p.challenge);
    }
  }, []);

  if (!progress) return null;

  const { challenge, current, completed } = progress;

  return (
    <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-muted">⚔️ {t.dailyChallengeTitle}</h2>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-muted tabular-nums">
          +{DAILY_CHALLENGE_XP} XP
        </span>
      </div>

      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-muted">{t[NAME_KEY[challenge.type]]}</span>
        <span className="text-sm font-bold text-fg tabular-nums">
          {current}
          <span className="font-normal text-faint"> / {challenge.target}</span>
        </span>
      </div>

      <ProgressBar
        value={current}
        max={challenge.target}
        label={`${current}/${challenge.target}`}
      />

      {(completed || recorded) && (
        <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1.5 text-right animate-slide-in-up">
          {t.dailyChallengeDone.replace('{n}', String(DAILY_CHALLENGE_XP))}
        </p>
      )}
    </div>
  );
}
