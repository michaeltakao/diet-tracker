'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, BarChart3 } from 'lucide-react';
import { getAppData, removeFoodEntry, updateFoodEntry } from '@/lib/data';
import { FoodEntry, DailyGoals } from '@/lib/types';
import MealCard from '@/components/MealCard';
import CalorieBar from '@/components/CalorieBar';
import WeeklyReportCard from '@/components/WeeklyReportCard';
import BottomNav from '@/components/BottomNav';
import { TrendsPanel } from '@/components/TrendsPanel';
import { recordEvent } from '@/lib/telemetry';
import { useLanguage } from '@/contexts/LanguageContext';

function getTodayDate(): string { return new Date().toISOString().split('T')[0]; }

function getWeekDates(anchor: Date): string[] {
  const day = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

import { fmtCalendarCell, fmtMonthDayDowLongJa, fmtLongEn } from '@/lib/format-date';
import { postJson, HttpError } from '@/lib/httpClient';
import { CARD_CLASS as cardCls } from '@/components/ui/Card';

function formatShort(dateStr: string, locale: string): { day: string; num: string } {
  if (locale !== 'ja-JP') {
    const d = new Date(dateStr + 'T00:00:00');
    return { day: ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()], num: String(d.getDate()) };
  }
  return fmtCalendarCell(dateStr);
}

function formatFull(dateStr: string, locale: string): string {
  return locale === 'ja-JP' ? fmtMonthDayDowLongJa(dateStr) : fmtLongEn(dateStr);
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

// ── Habit analysis helpers ────────────────────────────────────
interface DaySummary {
  date: string;
  mealCount: number;
  totalCalories: number;
  earliestMealHour: number | null;
  latestMealHour: number | null;
  lateNightMeals: number;
  workoutCount: number;
  workoutHours: number[];
  missedPostWorkoutWindow: boolean;
}

function buildHabitMatrix(allFood: FoodEntry[], allWorkouts: { date: string; addedAt: string; name: string }[]): {
  matrix: DaySummary[];
  daysWithData: number;
  avgDailyCalories: number;
  lateNightEatingDays: number;
  noBreakfastDays: number;
  avgBreakfastHour: number | null;
  workoutDays: number;
  missedPostWorkoutDays: number;
} {
  const today = new Date();
  const matrix: DaySummary[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];

    const meals = allFood.filter((e) => e.date === date);
    const workouts = allWorkouts.filter((w) => w.date === date);

    const mealHours = meals.map((m) => new Date(m.addedAt).getHours());
    const workoutHours = workouts.map((w) => new Date(w.addedAt).getHours());
    const latestMealHour = mealHours.length > 0 ? Math.max(...mealHours) : null;
    const lateNightMeals = mealHours.filter((h) => h >= 21).length;

    const lastWorkoutHour = workoutHours.length > 0 ? Math.max(...workoutHours) : null;
    const hadPostWorkoutMeal =
      lastWorkoutHour != null &&
      mealHours.some((h) => h > lastWorkoutHour && h <= lastWorkoutHour + 2);
    const missedPostWorkoutWindow = lastWorkoutHour != null && !hadPostWorkoutMeal;

    matrix.push({
      date,
      mealCount: meals.length,
      totalCalories: meals.reduce((s, m) => s + m.calories, 0),
      earliestMealHour: mealHours.length > 0 ? Math.min(...mealHours) : null,
      latestMealHour,
      lateNightMeals,
      workoutCount: workouts.length,
      workoutHours,
      missedPostWorkoutWindow,
    });
  }

  const daysWithData = matrix.filter((d) => d.mealCount > 0).length;
  const caloricDays  = matrix.filter((d) => d.totalCalories > 0);
  const avgDailyCalories = caloricDays.length > 0
    ? caloricDays.reduce((s, d) => s + d.totalCalories, 0) / caloricDays.length
    : 0;

  const lateNightEatingDays = matrix.filter((d) => d.lateNightMeals > 0).length;
  const noBreakfastDays     = matrix.filter((d) => d.mealCount > 0 && (d.earliestMealHour == null || d.earliestMealHour >= 10)).length;
  const workoutDays         = matrix.filter((d) => d.workoutCount > 0).length;
  const missedPostWorkoutDays = matrix.filter((d) => d.missedPostWorkoutWindow).length;

  const breakfastHours = matrix.flatMap((d) =>
    d.earliestMealHour != null && d.earliestMealHour < 10 ? [d.earliestMealHour] : []
  );
  const avgBreakfastHour = breakfastHours.length > 0
    ? Math.round(breakfastHours.reduce((s, h) => s + h, 0) / breakfastHours.length)
    : null;

  return { matrix, daysWithData, avgDailyCalories, lateNightEatingDays, noBreakfastDays, avgBreakfastHour, workoutDays, missedPostWorkoutDays };
}

// ── Skeleton ──────────────────────────────────────────────────
function HabitSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {['full', '4/5', '3/4'].map((w, i) => (
        <div key={i} className="rounded-2xl p-4 bg-surface-2">
          <div className="h-3 skeleton rounded w-1/4 mb-2.5" />
          {[w, '2/3'].map((ww, j) => (
            <div key={j} className={`h-3.5 skeleton rounded w-${ww} mb-1.5`} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface HabitReport {
  strengths: string[];
  frictions: string[];
  nextWeekTarget: string;
}

type LogView = 'weekly' | 'trends';

export default function LogPage() {
  const { t, lang } = useLanguage();
  const locale = lang === 'ja' ? 'ja-JP' : 'en-US';
  const [view, setView] = useState<LogView>('weekly');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [weekOffset, setWeekOffset]     = useState(0);
  const [allEntries, setAllEntries]     = useState<FoodEntry[]>([]);
  const [goals, setGoals]               = useState<DailyGoals>({ calories: 2000, protein: 150, fat: 60, carbs: 200, water: 2000 });

  // Habit report state
  const [habitReport, setHabitReport]     = useState<HabitReport | null>(null);
  const [habitLoading, setHabitLoading]   = useState(false);
  const [habitError, setHabitError]       = useState('');
  const [habitInsuff, setHabitInsuff]     = useState(false);

  const loadData = useCallback(() => {
    const data = getAppData();
    setAllEntries(data.foodEntries);
    setGoals(data.goals);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
  useEffect(() => { loadData(); }, [loadData]);

  // ?view=trends deep link (read on mount; keeps the page statically prerenderable)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL read on mount
    if (new URLSearchParams(window.location.search).get('view') === 'trends') setView('trends');
  }, []);

  const switchView = (next: LogView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'trends') url.searchParams.set('view', 'trends');
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
    if (next === 'weekly') recordEvent('weekly_view_viewed');
  };

  const anchorDate = new Date();
  anchorDate.setDate(anchorDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(anchorDate);

  const selectedEntries = allEntries.filter((e) => e.date === selectedDate);

  const getCaloriesForDate = (date: string) =>
    allEntries.filter((e) => e.date === date).reduce((sum, e) => sum + e.calories, 0);

  const handleDelete = (id: string) => { void removeFoodEntry(id); loadData(); };
  const handleEdit   = (updated: FoodEntry) => { void updateFoodEntry(updated); loadData(); };

  const totals = selectedEntries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, fat: acc.fat + e.fat, carbs: acc.carbs + e.carbs }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const grouped = MEAL_TYPES.reduce(
    (acc, type) => { acc[type] = selectedEntries.filter((e) => e.mealType === type); return acc; },
    {} as Record<string, FoodEntry[]>
  );

  const today = getTodayDate();

  const MEAL_LABELS: Record<string, string> = {
    breakfast: `🌅 ${t.breakfast}`,
    lunch:     `☀️ ${t.lunch}`,
    dinner:    `🌙 ${t.dinner}`,
    snack:     `🍎 ${t.snack}`,
  };

  const handleGenerateReport = async () => {
    setHabitLoading(true);
    setHabitError('');
    setHabitInsuff(false);
    try {
      const data = getAppData();
      const { matrix, daysWithData, avgDailyCalories, lateNightEatingDays, noBreakfastDays, avgBreakfastHour, workoutDays, missedPostWorkoutDays } =
        buildHabitMatrix(data.foodEntries, data.workoutEntries);

      if (daysWithData < 3) {
        setHabitInsuff(true);
        setHabitLoading(false);
        return;
      }

      const report = await postJson<HabitReport>('/api/habit-report', {
        daysWithData,
        totalDays: 7,
        avgDailyCalories,
        calorieGoal: data.goals.calories,
        lateNightEatingDays,
        noBreakfastDays,
        avgBreakfastHour,
        workoutDays,
        missedPostWorkoutDays,
        streak: 0, // could import getStreak() here if needed
        dailySummary: matrix,
      });
      setHabitReport(report);
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        setHabitInsuff(true);
        return;
      }
      setHabitError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setHabitLoading(false);
    }
  };


  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      {/* ── Header ─────────────────────────────── */}
      <div className="pt-6 pb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-fg tracking-tight">
          {t.weeklyLog} 📅
        </h1>
        {/* 週間 / トレンド segmented toggle */}
        <div role="tablist" aria-label={t.weeklyLog} className="flex p-1 bg-surface-2 rounded-2xl">
          {([['weekly', t.weeklyTab], ['trends', t.trendsTab]] as const).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                view === v ? 'bg-card text-fg shadow-card' : 'text-faint hover:text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'trends' && <TrendsPanel />}

      {view === 'weekly' && (
      <>
      {/* ── Week navigation ─────────────────────── */}
      <div className={`${cardCls} p-3 mb-3`}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label="前の週"
            className="p-2 rounded-xl text-faint hover:bg-surface-2 active:scale-90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="text-sm font-bold text-muted">
            {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${weekOffset > 0 ? '+' : ''}${weekOffset}w`}
          </span>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="次の週"
            className="p-2 rounded-xl text-faint hover:bg-surface-2 active:scale-90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-1">
          {weekDates.map((date) => {
            const { day, num } = formatShort(date, locale);
            const isSelected = date === selectedDate;
            const isToday    = date === today;
            const cals = getCaloriesForDate(date);
            const hasData = cals > 0;

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                aria-pressed={isSelected}
                aria-label={formatFull(date, locale)}
                className={`
                  flex-1 flex flex-col items-center py-2.5 rounded-2xl
                  transition-all duration-200
                  hover:scale-[1.04] active:scale-95
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                  ${isSelected
                    ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                    : 'hover:bg-surface-2 text-muted'}
                `}
              >
                <span className="text-[10px] font-bold">{day}</span>
                <span className={`text-sm font-black mt-0.5 ${isToday && !isSelected ? 'text-brand' : ''}`}>
                  {num}
                </span>
                {hasData && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white/80' : 'bg-brand'}`} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected day summary ─────────────────── */}
      <div className={`${cardCls} p-4 mb-3`}>
        <p className="text-xs font-medium text-faint mb-3">{formatFull(selectedDate, locale)}</p>
        <CalorieBar current={totals.calories} goal={goals.calories} />
        <div className="flex gap-3 mt-3 text-xs font-semibold">
          <span className="text-emerald-600 dark:text-emerald-400">P {totals.protein}g</span>
          <span className="text-warning">F {totals.fat}g</span>
          <span className="text-blue-600 dark:text-blue-400">C {totals.carbs}g</span>
        </div>
      </div>

      {/* ── Daily entries ─────────────────────────── */}
      {selectedEntries.length === 0 ? (
        <div className={`${cardCls} p-10 text-center mb-4`}>
          <p className="text-4xl mb-3" aria-hidden="true">📋</p>
          <p className="text-sm font-semibold text-faint">{t.noData}</p>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          {MEAL_TYPES.map((type) => {
            const typeEntries = grouped[type];
            if (typeEntries.length === 0) return null;
            return (
              <div key={type}>
                <h3 className="text-xs font-black text-faint uppercase tracking-widest mb-2 ml-1">
                  {MEAL_LABELS[type]}
                </h3>
                <div className="space-y-2">
                  {typeEntries.map((entry) => (
                    <MealCard key={entry.id} entry={entry} onDelete={handleDelete} onEdit={handleEdit} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Weekly Report ────────────────────────── */}
      <WeeklyReportCard />

      {/* ── AI Habit Analytics Widget ─────────────── */}
      <section className={`${cardCls} p-4`}>
        {/* Section header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-black text-fg">{t.habitReportTitle}</h2>
        </div>
        <p className="text-xs text-faint mb-4 pl-8">{t.habitReportSubtitle}</p>

        {/* Insufficient data */}
        {habitInsuff && (
          <div className="bg-warning-soft border border-warning/30 rounded-2xl p-4 mb-3 text-center animate-fade-in">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm font-semibold text-warning">{t.notEnoughData}</p>
          </div>
        )}

        {/* Generate button */}
        {!habitReport && !habitLoading && (
          <button
            onClick={handleGenerateReport}
            className="
              w-full py-3.5 rounded-2xl font-black text-sm text-white
              bg-gradient-to-r from-purple-500 to-indigo-500
              hover:from-purple-600 hover:to-indigo-600
              shadow-[0_4px_14px_rgba(168,85,247,0.4)]
              hover:scale-[1.01] active:scale-[0.98]
              transition-all duration-200
              flex items-center justify-center gap-2
            "
          >
            <Sparkles className="w-4 h-4" />
            {t.weeklyHabitReport}
          </button>
        )}

        {/* Loading skeleton */}
        {habitLoading && (
          <div>
            <p className="text-xs text-center text-purple-600 dark:text-purple-400 font-medium mb-3 animate-pulse">
              {t.generatingReport}
            </p>
            <HabitSkeleton />
          </div>
        )}

        {/* Error */}
        {habitError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-xs p-3 rounded-xl">
            ⚠️ {habitError}
            <button onClick={handleGenerateReport} className="ml-2 underline font-semibold">再試行</button>
          </div>
        )}

        {/* Report output */}
        {habitReport && (
          <div className="space-y-3 animate-fade-in">
            {/* Strengths */}
            <div className="bg-success-soft rounded-2xl p-4 border border-success/20">
              <p className="text-xs font-black text-success uppercase tracking-widest mb-3">
                {t.habitStrengths}
              </p>
              <ul className="space-y-2">
                {habitReport.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <span className="text-success font-black mt-0.5 flex-shrink-0">✓</span>
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Frictions */}
            <div className="bg-warning-soft rounded-2xl p-4 border border-warning/20">
              <p className="text-xs font-black text-warning uppercase tracking-widest mb-3">
                {t.habitFrictions}
              </p>
              <ul className="space-y-2">
                {habitReport.frictions.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <span className="text-warning font-black mt-0.5 flex-shrink-0">!</span>
                    <span className="leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next week target */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-800">
              <p className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-2">
                {t.habitNextWeek}
              </p>
              <p className="text-sm font-semibold text-fg leading-relaxed">
                {habitReport.nextWeekTarget}
              </p>
            </div>

            <button
              onClick={() => { setHabitReport(null); setHabitError(''); setHabitInsuff(false); }}
              className="w-full py-2 text-xs text-faint hover:text-fg underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {t.regenerate}
            </button>
          </div>
        )}
      </section>
      </>
      )}

      <BottomNav />
    </div>
  );
}
