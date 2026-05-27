'use client';

import { Trash2 } from 'lucide-react';
import { FoodEntry } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface MealCardProps {
  entry: FoodEntry;
  onDelete: (id: string) => void;
}

const MEAL_BADGE: Record<FoodEntry['mealType'], { bg: string; text: string }> = {
  breakfast: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  lunch:     { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  dinner:    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  snack:     { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
};

export default function MealCard({ entry, onDelete }: MealCardProps) {
  const { t } = useLanguage();
  const badge = MEAL_BADGE[entry.mealType];

  const mealLabel: Record<FoodEntry['mealType'], string> = {
    breakfast: t.breakfast,
    lunch:     t.lunch,
    dinner:    t.dinner,
    snack:     t.snack,
  };

  return (
    <div
      className="
        bg-white dark:bg-gray-800
        rounded-2xl p-4
        shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]
        border border-gray-50 dark:border-gray-700
        flex gap-3 items-start
        hover:scale-[1.01] active:scale-[0.99]
        transition-all duration-200
      "
    >
      {entry.photoDataUrl && (
        <img
          src={entry.photoDataUrl}
          alt={entry.name}
          className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
              {entry.name}
            </p>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${badge.bg} ${badge.text}`}>
              {mealLabel[entry.mealType]}
            </span>
          </div>
          <button
            onClick={() => onDelete(entry.id)}
            className="
              p-1.5 rounded-lg flex-shrink-0
              text-gray-300 dark:text-gray-600
              hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20
              active:scale-95
              transition-all duration-200
            "
            aria-label={t.delete}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-2.5">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {entry.calories.toLocaleString()} kcal
          </span>
          <div className="flex gap-2 text-xs">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">P {entry.protein}g</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">F {entry.fat}g</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">C {entry.carbs}g</span>
          </div>
        </div>
      </div>
    </div>
  );
}
