'use client';

/**
 * Water as one row (UX P0 slice 4): total vs goal, a thin bar, −200 / +200.
 * The 10-glass grid and the custom-ml field were replaced: their targets
 * were ≈28 px (UX_AUDIT #7) and water is not part of the core loop
 * (ADR-011), so it should not take a screen.
 */
import { Droplets, Minus, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface WaterTrackerProps {
  current: number; // ml
  goal: number;    // ml
  onAdd: (ml: number) => void;
}

const STEP_ML = 200;

const BTN = `
  min-w-11 min-h-11 inline-flex items-center justify-center gap-0.5 rounded-xl
  text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20
  hover:bg-blue-100 dark:hover:bg-blue-800/30 active:scale-95 transition-all duration-150
  disabled:opacity-40 disabled:cursor-not-allowed
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
`;

export default function WaterTracker({ current, goal, onAdd }: WaterTrackerProps) {
  const { t } = useLanguage();
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-2" data-testid="water-row">
      <Droplets size={18} className="text-blue-500 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-muted truncate">{t.waterShort}</span>
          <span className="text-xs font-medium text-faint tabular-nums whitespace-nowrap shrink-0">
            {current.toLocaleString()} / {goal.toLocaleString()} ml
          </span>
        </div>
        <div
          className="w-full bg-surface-2 rounded-full h-1.5 mt-1 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t.waterIntake}
        >
          <div className="bg-gradient-to-r from-sky-400 to-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAdd(-Math.min(STEP_ML, current))}
        disabled={current <= 0}
        aria-label={t.waterCompactMinus}
        className={BTN}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onAdd(STEP_ML)} className={`${BTN} px-2.5 whitespace-nowrap`}>
        <Plus size={14} aria-hidden="true" />{STEP_ML}ml
      </button>
    </div>
  );
}
