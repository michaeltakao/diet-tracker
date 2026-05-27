'use client';

import { Trash2 } from 'lucide-react';
import { FoodEntry } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface MealCardProps {
  entry: FoodEntry;
  onDelete: (id: string) => void;
}

const MEAL_BADGE_COLORS: Record<FoodEntry['mealType'], string> = {
  breakfast: 'bg-yellow-100 text-yellow-700',
  lunch: 'bg-green-100 text-green-700',
  dinner: 'bg-blue-100 text-blue-700',
  snack: 'bg-purple-100 text-purple-700',
};

export default function MealCard({ entry, onDelete }: MealCardProps) {
  const { t } = useLanguage();
  const color = MEAL_BADGE_COLORS[entry.mealType];

  const mealLabel: Record<FoodEntry['mealType'], string> = {
    breakfast: t.breakfast,
    lunch: t.lunch,
    dinner: t.dinner,
    snack: t.snack,
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 items-start">
      {entry.photoDataUrl && (
        <img
          src={entry.photoDataUrl}
          alt={entry.name}
          className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 truncate">{entry.name}</p>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${color}`}>
              {mealLabel[entry.mealType]}
            </span>
          </div>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
            aria-label={t.delete}
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700">{entry.calories} kcal</span>
          <span className="text-green-600">P {entry.protein}g</span>
          <span className="text-amber-600">F {entry.fat}g</span>
          <span className="text-blue-600">C {entry.carbs}g</span>
        </div>
      </div>
    </div>
  );
}
