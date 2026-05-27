'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAppData } from '@/lib/storage';
import { FoodEntry, DailyGoals } from '@/lib/types';
import MealCard from '@/components/MealCard';
import CalorieBar from '@/components/CalorieBar';
import BottomNav from '@/components/BottomNav';
import { removeFoodEntry } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekDates(anchor: Date): string[] {
  // Monday-based week containing anchor
  const day = anchor.getDay(); // 0=Sun
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function formatShort(dateStr: string): { day: string; num: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num: String(d.getDate()),
  };
}

function formatFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export default function LogPage() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [weekOffset, setWeekOffset] = useState(0);
  const [allEntries, setAllEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<DailyGoals>({ calories: 2000, protein: 150, fat: 60, carbs: 200 });

  const loadData = () => {
    const data = getAppData();
    setAllEntries(data.foodEntries);
    setGoals(data.goals);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute week dates
  const anchorDate = new Date();
  anchorDate.setDate(anchorDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(anchorDate);

  const selectedEntries = allEntries.filter((e) => e.date === selectedDate);

  const getCaloriesForDate = (date: string) =>
    allEntries.filter((e) => e.date === date).reduce((sum, e) => sum + e.calories, 0);

  const handleDelete = (id: string) => {
    removeFoodEntry(id);
    loadData();
  };

  const totals = selectedEntries.reduce(
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
      acc[type] = selectedEntries.filter((e) => e.mealType === type);
      return acc;
    },
    {} as Record<string, FoodEntry[]>
  );

  const today = getTodayDate();

  const MEAL_LABELS: Record<string, string> = {
    breakfast: `🌅 ${t.breakfast}`,
    lunch: `☀️ ${t.lunch}`,
    dinner: `🌙 ${t.dinner}`,
    snack: `🍎 ${t.snack}`,
  };

  return (
    <div className="max-w-md mx-auto pb-24 px-4">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.weeklyLog} 📅</h1>
      </div>

      {/* Week navigation */}
      <div className="bg-white rounded-2xl shadow-sm p-3 mb-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${weekOffset > 0 ? '+' : ''}${weekOffset}w`}
          </span>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>

        {/* 7-day selector */}
        <div className="flex gap-1">
          {weekDates.map((date) => {
            const { day, num } = formatShort(date);
            const isSelected = date === selectedDate;
            const isToday = date === today;
            const cals = getCaloriesForDate(date);
            const hasData = cals > 0;

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-green-500 text-white'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className="text-[10px] font-medium">{day}</span>
                <span className={`text-sm font-bold mt-0.5 ${isToday && !isSelected ? 'text-green-500' : ''}`}>
                  {num}
                </span>
                {hasData && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white/70' : 'bg-green-400'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day summary */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">{formatFull(selectedDate)}</p>
        <CalorieBar current={totals.calories} goal={goals.calories} />
        <div className="flex gap-3 mt-3 text-xs text-gray-600">
          <span className="text-green-600 font-medium">P {totals.protein}g</span>
          <span className="text-amber-600 font-medium">F {totals.fat}g</span>
          <span className="text-blue-600 font-medium">C {totals.carbs}g</span>
        </div>
      </div>

      {/* Entries for selected day */}
      {selectedEntries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm font-medium">{t.noData}</p>
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

      <BottomNav />
    </div>
  );
}
