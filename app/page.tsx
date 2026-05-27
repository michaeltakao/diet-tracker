'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings, Flame } from 'lucide-react';
import { getAppData, removeFoodEntry, addWater, getWaterForDate, getStreak, checkAndAwardBadges, getBadges } from '@/lib/storage';
import { FoodEntry, DailyGoals, Badge } from '@/lib/types';
import BadgeCelebration from '@/components/BadgeCelebration';
import CalorieBar from '@/components/CalorieBar';
import PFCDonut from '@/components/PFCDonut';
import MacroBar from '@/components/MacroBar';
import MealCard from '@/components/MealCard';
import WaterTracker from '@/components/WaterTracker';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}

export default function HomePage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<DailyGoals>({ calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 });
  const [water, setWater] = useState(0);
  const [streak, setStreak] = useState(0);
  const [today] = useState(getTodayDate());
  const [celebrationBadges, setCelebrationBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);

  const loadData = () => {
    const data = getAppData();
    const todayEntries = data.foodEntries.filter((e) => e.date === today);
    setEntries(todayEntries);
    setGoals(data.goals);
    setWater(getWaterForDate(today));
    setStreak(getStreak());
    setEarnedBadges(getBadges());
  };

  useEffect(() => {
    loadData();
    // Check badges when home page loads (after adding meals, etc.)
    const newBadges = checkAndAwardBadges(getTodayDate());
    if (newBadges.length > 0) {
      setCelebrationBadges(newBadges);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (id: string) => {
    removeFoodEntry(id);
    loadData();
  };

  const handleAddWater = (ml: number) => {
    addWater(today, ml);
    setWater(getWaterForDate(today));
    // Check water goal badge after adding water
    const newBadges = checkAndAwardBadges(today);
    if (newBadges.length > 0) {
      setCelebrationBadges(newBadges);
      setEarnedBadges(getBadges());
    }
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

  const remaining = Math.max(0, goals.calories - totals.calories);
  const over = totals.calories > goals.calories;

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
      {/* Badge Celebration */}
      {celebrationBadges.length > 0 && (
        <BadgeCelebration
          badges={celebrationBadges}
          onClose={() => setCelebrationBadges([])}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.appName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(today)}</p>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-orange-50 px-2.5 py-1.5 rounded-xl">
              <Flame size={14} className="text-orange-500" />
              <span className="text-xs font-bold text-orange-600">{streak}{t.streakDays}</span>
            </div>
          )}
          <Link
            href="/settings"
            className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Settings size={20} />
          </Link>
        </div>
      </div>

      {/* Remaining calories — hero number */}
      <div className={`rounded-2xl p-4 mb-3 ${over ? 'bg-red-50' : 'bg-green-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-0.5">
          {over ? '⚠️ オーバー' : t.remaining}
        </p>
        <div className="flex items-end gap-2">
          <span className={`text-4xl font-bold ${over ? 'text-red-600' : 'text-green-600'}`}>
            {over ? `+${totals.calories - goals.calories}` : remaining}
          </span>
          <span className="text-sm text-gray-500 mb-1">kcal</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {totals.calories} / {goals.calories} kcal {t.consumed}
        </p>
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
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
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

      {/* Water Tracker */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <WaterTracker
          current={water}
          goal={goals.water ?? 2000}
          onAdd={handleAddWater}
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

      {/* Badge shelf */}
      {earnedBadges.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">🏅 獲得バッジ</h2>
          <div className="flex flex-wrap gap-2">
            {[...earnedBadges]
              .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
              .slice(0, 8)
              .map((b) => (
                <div
                  key={b.id}
                  title={b.description}
                  className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-full px-2.5 py-1"
                >
                  <span className="text-sm">{b.icon}</span>
                  <span className="text-xs font-semibold text-yellow-800">
                    {b.name.replace(/^[^\s]+\s/, '')}
                  </span>
                </div>
              ))}
          </div>
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
