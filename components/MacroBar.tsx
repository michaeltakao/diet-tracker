'use client';

import { useLanguage } from '@/contexts/LanguageContext';

interface MacroBarProps {
  protein: number;
  fat: number;
  carbs: number;
  goalProtein: number;
  goalFat: number;
  goalCarbs: number;
}

interface SingleBarProps {
  label: string;
  current: number;
  goal: number;
  fillClass: string;   // e.g. "bg-brand-500"
  trackClass: string;  // e.g. "bg-brand-100 dark:bg-brand-900/30"
  textClass: string;   // e.g. "text-brand-600 dark:text-brand-400"
}

function SingleBar({ label, current, goal, fillClass, trackClass, textClass }: SingleBarProps) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const isOver = current > goal;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className={`text-xs font-semibold ${textClass}`}>{label}</span>
        <span className={`text-xs font-bold ${isOver ? 'text-danger' : 'text-muted'} tabular-nums`}>
          {current}g <span className="font-normal text-faint">/ {goal}g</span>
        </span>
      </div>
      <div
        className={`h-2.5 w-full rounded-full overflow-hidden ${trackClass}`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${isOver ? 'bg-red-400' : fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MacroBar({ protein, fat, carbs, goalProtein, goalFat, goalCarbs }: MacroBarProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3.5">
      <SingleBar
        label={t.protein}
        current={protein}
        goal={goalProtein}
        fillClass="bg-gradient-to-r from-brand-400 to-green-500"
        trackClass="bg-brand-100 dark:bg-brand-900/30"
        textClass="text-brand-600 dark:text-brand-400"
      />
      <SingleBar
        label={t.fat}
        current={fat}
        goal={goalFat}
        fillClass="bg-gradient-to-r from-amber-400 to-orange-400"
        trackClass="bg-amber-100 dark:bg-amber-900/30"
        textClass="text-warning"
      />
      <SingleBar
        label={t.carbs}
        current={carbs}
        goal={goalCarbs}
        fillClass="bg-gradient-to-r from-blue-400 to-indigo-500"
        trackClass="bg-blue-100 dark:bg-blue-900/30"
        textClass="text-blue-600 dark:text-blue-400"
      />
    </div>
  );
}
