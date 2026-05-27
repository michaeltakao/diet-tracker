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
  color: string;
  bgColor: string;
}

function SingleBar({ label, current, goal, color, bgColor }: SingleBarProps) {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-700">
          {current}g / {goal}g
        </span>
      </div>
      <div className={`h-2 w-full rounded-full overflow-hidden ${bgColor}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function MacroBar({ protein, fat, carbs, goalProtein, goalFat, goalCarbs }: MacroBarProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3">
      <SingleBar
        label={t.protein}
        current={protein}
        goal={goalProtein}
        color="bg-green-500"
        bgColor="bg-green-100"
      />
      <SingleBar
        label={t.fat}
        current={fat}
        goal={goalFat}
        color="bg-amber-400"
        bgColor="bg-amber-100"
      />
      <SingleBar
        label={t.carbs}
        current={carbs}
        goal={goalCarbs}
        color="bg-blue-500"
        bgColor="bg-blue-100"
      />
    </div>
  );
}
