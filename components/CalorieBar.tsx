'use client';

import { useLanguage } from '@/contexts/LanguageContext';

interface CalorieBarProps {
  current: number;
  goal: number;
}

export default function CalorieBar({ current, goal }: CalorieBarProps) {
  const { t } = useLanguage();
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const isOver = current > goal;
  const isNear = !isOver && percentage > 85;

  const barClass = isOver
    ? 'bg-gradient-to-r from-amber-500 to-red-500'
    : isNear
    ? 'bg-gradient-to-r from-orange-400 to-amber-400'
    : 'bg-gradient-to-r from-brand-400 to-brand-500';

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-muted">{t.caloriesLabel}</span>
        <span className={`text-sm font-bold ${isOver ? 'text-danger' : 'text-fg'} tabular-nums`}>
          {current.toLocaleString()} <span className="font-normal text-faint">/ {goal.toLocaleString()} kcal</span>
        </span>
      </div>

      {/* Track */}
      <div
        className="h-3 w-full bg-surface-2 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.caloriesLabel}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isOver && (
        <p className="text-xs font-semibold text-danger mt-1.5 text-right animate-slide-in-up tabular-nums">
          +{(current - goal).toLocaleString()} kcal over
        </p>
      )}
    </div>
  );
}
