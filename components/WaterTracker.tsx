'use client';

import { useState } from 'react';
import { Droplets } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMounted } from '@/lib/use-mounted';

interface WaterTrackerProps {
  current: number; // ml
  goal: number;    // ml
  onAdd: (ml: number) => void;
}

const GLASS_ML = 200;

export default function WaterTracker({ current, goal, onAdd }: WaterTrackerProps) {
  const { t } = useLanguage();
  const [customMl, setCustomMl] = useState('');
  const mounted = useMounted();

  const handleCustomAdd = () => {
    const ml = parseInt(customMl, 10);
    if (!isNaN(ml) && ml > 0) { onAdd(ml); setCustomMl(''); }
  };
  const glasses     = Math.max(1, Math.floor(goal / GLASS_ML));
  const filledGlasses = Math.min(Math.floor(current / GLASS_ML), glasses);
  const pct = Math.min((current / goal) * 100, 100);
  const isGoalMet = current >= goal;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isGoalMet ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-blue-50 dark:bg-blue-900/20'}`} aria-hidden="true">
            <Droplets size={16} className={isGoalMet ? 'text-blue-600' : 'text-blue-500'} />
          </div>
          <span className="text-sm font-semibold text-muted">{t.waterIntake}</span>
          {isGoalMet && <span className="text-xs font-bold text-blue-600 dark:text-blue-400 animate-slide-in-up">✓ 達成！</span>}
        </div>
        <span className="text-xs font-medium text-faint tabular-nums">
          {current.toLocaleString()} / {goal.toLocaleString()} ml
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full bg-surface-2 rounded-full h-2.5 mb-3 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.waterIntake}
      >
        <div
          className="bg-gradient-to-r from-sky-400 to-blue-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Glass icons row */}
      <div className="flex gap-1 flex-wrap mb-3">
        {Array.from({ length: glasses }).map((_, i) => {
          const isFilled = i < filledGlasses;
          return (
            <button
              key={i}
              onClick={() => {
                const targetMl = (i + 1) * GLASS_ML;
                if (current >= targetMl) {
                  onAdd(-(current - i * GLASS_ML));
                } else {
                  onAdd(targetMl - current);
                }
              }}
              className={`
                text-lg rounded-md transition-all duration-200
                hover:scale-110 active:scale-95
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                ${isFilled ? 'opacity-100' : 'opacity-30 grayscale'}
              `}
              title={`${(i + 1) * GLASS_ML} ml`}
              aria-label={`${(i + 1) * GLASS_ML} ml`}
              aria-pressed={isFilled}
            >
              <span aria-hidden="true">💧</span>
            </button>
          );
        })}
      </div>

      {/* Quick-add buttons */}
      <div className="flex gap-2">
        {[200, 350, 500].map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            className="
              flex-1 py-2 text-xs font-semibold
              text-blue-600 dark:text-blue-400
              bg-blue-50 dark:bg-blue-900/20
              hover:bg-blue-100 dark:hover:bg-blue-800/30
              active:scale-95
              rounded-xl transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
            "
          >
            +{ml}ml
          </button>
        ))}
      </div>

      {/* Custom ml input — client-only to avoid SSR hydration mismatch */}
      {mounted && (
        <div className="flex gap-2 mt-2">
          <input
            type="number"
            value={customMl}
            onChange={(e) => setCustomMl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd()}
            placeholder="カスタム ml"
            min="1"
            aria-label="カスタム水分量 (ml)"
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
            onClick={handleCustomAdd}
            disabled={!customMl || isNaN(parseInt(customMl, 10)) || parseInt(customMl, 10) <= 0}
            className="
              px-3 py-2 text-xs font-bold rounded-xl
              bg-blue-600 text-white
              hover:bg-blue-700
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-95 transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
            "
          >
            +追加
          </button>
        </div>
      )}
    </div>
  );
}
