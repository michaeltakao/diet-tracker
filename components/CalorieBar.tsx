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

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-gray-700">{t.caloriesLabel}</span>
        <span className={`text-sm font-semibold ${isOver ? 'text-red-500' : 'text-gray-700'}`}>
          {current.toLocaleString()} / {goal.toLocaleString()} kcal
        </span>
      </div>
      <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOver ? 'bg-red-500' : percentage > 85 ? 'bg-orange-400' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isOver && (
        <p className="text-xs text-red-500 mt-1 text-right">
          +{(current - goal).toLocaleString()} kcal over goal
        </p>
      )}
    </div>
  );
}
