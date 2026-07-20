'use client';

/**
 * Manual step tracking card (phase D) — number input + quick +1000 chips,
 * mirroring WaterTracker's structure. Steps do NOT join the any-log streak
 * (deliberate scope cut — see lib/steps-goal.ts / STATUS.md).
 */

import { useState } from 'react';
import { Footprints } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { STEP_GOAL_DEFAULT, stepsProgress, stepsToKm, clampSteps } from '@/lib/steps-goal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMounted } from '@/lib/use-mounted';

interface StepsTrackerProps {
  current: number;
  goal?: number;
  onChange: (steps: number) => void;
}

export default function StepsTracker({ current, goal = STEP_GOAL_DEFAULT, onChange }: StepsTrackerProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const mounted = useMounted();

  const progress = stepsProgress(current, goal);
  const km = stepsToKm(current);

  const commitDraft = () => {
    const v = parseInt(draft, 10);
    if (!Number.isNaN(v) && v >= 0) onChange(clampSteps(v));
    setDraft('');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${progress.goalReached ? 'bg-fox-soft' : 'bg-surface-2'}`} aria-hidden="true">
            <Footprints size={16} className={progress.goalReached ? 'text-fox' : 'text-faint'} />
          </div>
          <span className="text-sm font-semibold text-muted">{t.stepsTitle}</span>
          {progress.goalReached && <span className="text-xs font-bold text-fox animate-slide-in-up">✓ 達成！</span>}
        </div>
        <span className="text-xs font-medium text-faint tabular-nums">
          {progress.steps.toLocaleString()} / {progress.goal.toLocaleString()} {t.stepsUnit}
        </span>
      </div>

      <ProgressBar
        value={progress.steps}
        max={progress.goal}
        variant="fox"
        ariaLabel={t.stepsTitle}
        className="mb-2"
      />

      {progress.steps > 0 && (
        <p className="text-[10px] text-faint mb-3 tabular-nums">
          {t.stepsDistanceApprox.replace('{km}', String(km))}
        </p>
      )}

      {/* Quick-add + manual entry — client-only to avoid SSR hydration mismatch */}
      {mounted && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {[1000, 2000].map((n) => (
              <button
                key={n}
                onClick={() => onChange(clampSteps(current + n))}
                className="
                  flex-1 py-2 text-xs font-semibold
                  text-fox
                  bg-fox-soft
                  hover:opacity-80
                  active:scale-95
                  rounded-xl transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                "
              >
                +{n === 1000 ? '1,000' : '2,000'}歩
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitDraft()}
              placeholder={t.stepsInputPlaceholder}
              min="0"
              aria-label={t.stepsTitle}
              className="
                flex-1 px-3 py-2 text-xs font-semibold rounded-xl
                border border-line-strong
                bg-surface-2
                text-fg
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus:border-transparent
                placeholder:text-faint
              "
            />
            <button
              onClick={commitDraft}
              disabled={!draft || Number.isNaN(parseInt(draft, 10))}
              className="
                px-3 py-2 text-xs font-bold rounded-xl
                bg-fox text-white
                hover:opacity-90
                disabled:opacity-40 disabled:cursor-not-allowed
                active:scale-95 transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
              "
            >
              {t.addButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
