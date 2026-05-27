'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings, Flame } from 'lucide-react';
import {
  getAppData, removeFoodEntry, addWater, getWaterForDate, getStreak,
  checkAndAwardBadges, getBadges,
} from '@/lib/data';
import { FoodEntry, DailyGoals, Badge } from '@/lib/types';
import CalorieBar from '@/components/CalorieBar';
import PFCDonut from '@/components/PFCDonut';
import MacroBar from '@/components/MacroBar';
import MealCard from '@/components/MealCard';
import WaterTracker from '@/components/WaterTracker';
import BadgeShelf from '@/components/BadgeShelf';
import BadgeCelebration from '@/components/BadgeCelebration';
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
  const [entries, setEntries]   = useState<FoodEntry[]>([]);
  const [goals, setGoals]       = useState<DailyGoals>({ calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 });
  const [water, setWater]       = useState(0);
  const [streak, setStreak]     = useState(0);
  const [today]                 = useState(getTodayDate());
  const [celebrationBadges, setCelebrationBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges]           = useState<Badge[]>([]);

  const loadData = () => {
    const data = getAppData();
    setEntries(data.foodEntries.filter((e) => e.date === today));
    setGoals(data.goals);
    setWater(getWaterForDate(today));
    setStreak(getStreak());
    setEarnedBadges(getBadges());
  };

  useEffect(() => {
    loadData();
    void checkAndAwardBadges(getTodayDate()).then(newBadges => {
      if (newBadges.length > 0) setCelebrationBadges(newBadges);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (id: string) => { removeFoodEntry(id); loadData(); };

  const handleAddWater = async (ml: number) => {
    await addWater(today, ml);
    setWater(getWaterForDate(today));
    const newBadges = await checkAndAwardBadges(today);
    if (newBadges.length > 0) { setCelebrationBadges(newBadges); setEarnedBadges(getBadges()); }
  };

  const totals = entries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, fat: acc.fat + e.fat, carbs: acc.carbs + e.carbs }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const remaining = Math.max(0, goals.calories - totals.calories);
  const over      = totals.calories > goals.calories;

  const grouped = MEAL_TYPES.reduce(
    (acc, type) => { acc[type] = entries.filter((e) => e.mealType === type); return acc; },
    {} as Record<string, FoodEntry[]>
  );

  const MEAL_LABELS: Record<string, string> = {
    breakfast: `🌅 ${t.breakfast}`,
    lunch:     `☀️ ${t.lunch}`,
    dinner:    `🌙 ${t.dinner}`,
    snack:     `🍎 ${t.snack}`,
  };

  return (
    <div className="max-w-md mx-auto pb-28 px-4 bg-[var(--background)] min-h-screen">
      {/* Badge Celebration */}
      {celebrationBadges.length > 0 && (
        <BadgeCelebration badges={celebrationBadges} onClose={() => setCelebrationBadges([])} />
      )}

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{t.appName}</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">{formatDate(today)}</p>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 px-2.5 py-1.5 rounded-2xl">
              <Flame size={13} className="text-orange-500" />
              <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                {streak}{t.streakDays}
              </span>
            </div>
          )}
          <Link
            href="/settings"
            className="
              w-10 h-10 rounded-2xl
              bg-white dark:bg-gray-800
              shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]
              border border-gray-100 dark:border-gray-700
              flex items-center justify-center
              text-gray-400 dark:text-gray-500
              hover:text-gray-700 dark:hover:text-gray-300
              hover:scale-[1.04] active:scale-95
              transition-all duration-200
            "
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {/* ── Hero calorie card ──────────────────────── */}
      <div className={`
        rounded-3xl p-5 mb-3
        ${over
          ? 'bg-gradient-to-br from-amber-500 to-red-500'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600'}
        shadow-[0_16px_48px_rgb(0,0,0,0.12)]
      `}>
        <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
          {over ? '⚠️ オーバー' : t.remaining}
        </p>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-5xl font-black text-white tracking-tight leading-none">
            {over ? `+${(totals.calories - goals.calories).toLocaleString()}` : remaining.toLocaleString()}
          </span>
          <span className="text-lg text-white/70 font-medium mb-1">kcal</span>
        </div>
        <p className="text-xs text-white/60 font-medium">
          {totals.calories.toLocaleString()} / {goals.calories.toLocaleString()} kcal {t.consumed}
        </p>
      </div>

      {/* ── Calorie bar ─────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700 p-4 mb-3">
        <CalorieBar current={totals.calories} goal={goals.calories} />
      </div>

      {/* ── PFC Donut ───────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700 p-4 mb-3">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t.macroBreakdown}</h2>
        <PFCDonut
          protein={totals.protein} fat={totals.fat} carbs={totals.carbs}
          goalProtein={goals.protein} goalFat={goals.fat} goalCarbs={goals.carbs}
        />
      </div>

      {/* ── Macro bars ──────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700 p-4 mb-3">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t.macros}</h2>
        <MacroBar
          protein={totals.protein} fat={totals.fat} carbs={totals.carbs}
          goalProtein={goals.protein} goalFat={goals.fat} goalCarbs={goals.carbs}
        />
      </div>

      {/* ── Water Tracker ───────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700 p-4 mb-3">
        <WaterTracker current={water} goal={goals.water ?? 2000} onAdd={handleAddWater} />
      </div>

      {/* ── Badge shelf ─────────────────────────────── */}
      {earnedBadges.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700 p-4 mb-3">
          <BadgeShelf badges={earnedBadges} title="🏅 獲得バッジ" />
        </div>
      )}

      {/* ── Meal list ───────────────────────────────── */}
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 mt-1">{t.todayMeals}</h2>

      {entries.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 text-center">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t.noMeals}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t.noMealsSub}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.map((type) => {
            const typeEntries = grouped[type];
            if (typeEntries.length === 0) return null;
            return (
              <div key={type}>
                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
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

      {/* ── FAB ─────────────────────────────────────── */}
      <Link
        href="/add"
        className="
          fixed bottom-20 right-4 z-40
          w-14 h-14 rounded-full
          bg-gradient-to-br from-green-500 to-emerald-600
          shadow-[0_8px_24px_rgba(34,197,94,0.5)]
          flex items-center justify-center text-white
          hover:scale-110 active:scale-95
          transition-all duration-200
        "
        aria-label={t.addMeal}
      >
        <Plus size={28} strokeWidth={2.5} />
      </Link>

      <BottomNav />
    </div>
  );
}
