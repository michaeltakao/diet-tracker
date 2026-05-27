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
    : 'bg-gradient-to-r from-emerald-400 to-green-500';

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.caloriesLabel}</span>
        <span className={`text-sm font-bold ${isOver ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
          {current.toLocaleString()} <span className="font-normal text-gray-400 dark:text-gray-500">/ {goal.toLocaleString()} kcal</span>
        </span>
      </div>

      {/* Track */}
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isOver && (
        <p className="text-xs font-semibold text-red-500 mt-1.5 text-right animate-slide-in-up">
          +{(current - goal).toLocaleString()} kcal over
        </p>
      )}
    </div>
  );
}
