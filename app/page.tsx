'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings } from 'lucide-react';
import { getAppData } from '@/lib/storage';
import { FoodEntry, DailyGoals } from '@/lib/types';
import CalorieBar from '@/components/CalorieBar';
import PFCDonut from '@/components/PFCDonut';
import MacroBar from '@/components/MacroBar';
import MealCard from '@/components/MealCard';
import BottomNav from '@/components/BottomNav';
import { removeFoodEntry } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function HomePage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<DailyGoals>({ calories: 2000, protein: 150, fat: 60, carbs: 200 });
  const [today] = useState(getTodayDate());

  const loadData = () => {
    const data = getAppData();
    const todayEntries = data.foodEntries.filter((e) => e.date === today);
    setEntries(todayEntries);
    setGoals(data.goals);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (id: string) => {
    removeFoodEntry(id);
    loadData();
  };

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const grouped = MEAL_TYPES.reduce(
    (acc, type) => {
      acc[type] = entries.filter((e) => e.mealType === type);
      return acc;
    },
    {} as Record<string, FoodEntry[]>
  );

  const MEAL_LABELS: Record<string, string> = {
    breakfast: `🌅 ${t.breakfast}`,
    lunch: `☀️ ${t.lunch}`,
    dinner: `🌙 ${t.dinner}`,
    snack: `🍎 ${t.snack}`,
  };

  return (
    <div className="max-w-md mx-auto pb-24 px-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.appName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(today)}</p>
        </div>
        <Link
          href="/settings"
          className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Settings size={20} />
        </Link>
      </div>

      {/* Calorie Bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <CalorieBar current={totals.calories} goal={goals.calories} />
      </div>

      {/* PFC Donut */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">{t.macroBreakdown}</h2>
        <PFCDonut
          protein={totals.protein}
          fat={totals.fat}
          carbs={totals.carbs}
          goalProtein={goals.protein}
          goalFat={goals.fat}
          goalCarbs={goals.carbs}
        />
      </div>

      {/* Macro Bars */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t.macros}</h2>
        <MacroBar
          protein={totals.protein}
          fat={totals.fat}
          carbs={totals.carbs}
          goalProtein={goals.protein}
          goalFat={goals.fat}
          goalCarbs={goals.carbs}
        />
      </div>

      {/* Meal List */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{t.todayMeals}</h2>

      {entries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">🍽️</p>
          <p className="text-sm font-medium">{t.noMeals}</p>
          <p className="text-xs mt-1">{t.noMealsSub}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.map((type) => {
            const typeEntries = grouped[type];
            if (typeEntries.length === 0) return null;
            return (
              <div key={type}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {MEAL_LABELS[type]}
                </h3>
                <div className="space-y-2">
                  {typeEntries.map((entry) => (
                    <MealCard key={entry.id} entry={entry} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/add"
        className="fixed bottom-20 right-4 w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
        aria-label={t.addMeal}
      >
        <Plus size={28} />
      </Link>

      <BottomNav />
    </div>
  );
}
