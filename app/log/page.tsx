'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, BookmarkPlus } from 'lucide-react';
import { getAppData, getRealGoals, removeFoodEntry, updateFoodEntry } from '@/lib/data';
import { saveMealTemplate } from '@/lib/data/meal-templates';
import { FoodEntry, DailyGoals, MealTemplate } from '@/lib/types';
import MealCard from '@/components/MealCard';
import CalorieBar from '@/components/CalorieBar';
import { MonthCalendar, type DayCategory } from '@/components/MonthCalendar';
import { shiftDate, weekStartOf } from '@/lib/format-date';
import SusSurveyCard from '@/components/SusSurveyCard';
import BottomNav from '@/components/BottomNav';
import { TrendsPanel } from '@/components/TrendsPanel';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { recordEvent } from '@/lib/telemetry';
import { useLanguage } from '@/contexts/LanguageContext';

function getTodayDate(): string { return todayJst(); }

/** Monday-first JST week (YYYY-MM-DD ×7) containing `anchor`. */
function getWeekDates(anchor: string): string[] {
  const monday = weekStartOf(anchor);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

import { fmtCalendarCell, fmtMonthDayDowLongJa, fmtLongEn, todayJst } from '@/lib/format-date';
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

type LogView = 'weekly' | 'month' | 'trends';

const EMPTY_DAY_SETS: Record<DayCategory, Set<string>> = {
  meal: new Set(), workout: new Set(), weight: new Set(),
};

export default function LogPage() {
  const { t, lang } = useLanguage();
  const locale = lang === 'ja' ? 'ja-JP' : 'en-US';
  const [view, setView] = useState<LogView>('weekly');
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [weekOffset, setWeekOffset]     = useState(0);
  const [allEntries, setAllEntries]     = useState<FoodEntry[]>([]);
  // null = no real goals set → goal-colored UI hidden, AI features gated
  const [goals, setGoals]               = useState<DailyGoals | null>(null);
  // Per-category logged-day sets for the month calendar dots.
  const [daySets, setDaySets]           = useState<Record<DayCategory, Set<string>>>(EMPTY_DAY_SETS);

  // "Save this meal" as a template
  const [templateSource, setTemplateSource] = useState<FoodEntry['mealType'] | null>(null);
  const [templateToast, setTemplateToast]   = useState(false);

  const loadData = useCallback(() => {
    const data = getAppData();
    setAllEntries(data.foodEntries);
    setGoals(getRealGoals());
    setDaySets({
      meal:    new Set(data.foodEntries.map((e) => e.date)),
      workout: new Set(data.workoutEntries.map((e) => e.date)),
      weight:  new Set(data.weightEntries.map((e) => e.date)),
    });
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
  useEffect(() => { loadData(); }, [loadData]);

  // ?view= deep link (read on mount; keeps the page statically prerenderable)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL read on mount
    if (v === 'trends' || v === 'month') setView(v);
  }, []);

  const switchView = (next: LogView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'trends' || next === 'month') url.searchParams.set('view', next);
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
    if (next === 'weekly') recordEvent('weekly_view_viewed');
  };

  /** Month-view day tap → jump the weekly view to that day (reuses its rendering). */
  const jumpToDay = (date: string) => {
    setSelectedDate(date);
    const DAY_MS = 86_400_000;
    const diffDays = Math.round(
      (Date.parse(`${weekStartOf(date)}T00:00:00Z`) - Date.parse(`${weekStartOf(getTodayDate())}T00:00:00Z`)) / DAY_MS,
    );
    setWeekOffset(diffDays / 7);
    switchView('weekly');
  };

  const weekDates = getWeekDates(shiftDate(getTodayDate(), weekOffset * 7));

  const selectedEntries = allEntries.filter((e) => e.date === selectedDate);

  const getCaloriesForDate = (date: string) =>
    allEntries.filter((e) => e.date === date).reduce((sum, e) => sum + e.calories, 0);

  const handleDelete = (id: string) => { void removeFoodEntry(id); loadData(); };
  const handleEdit   = (updated: FoodEntry) => { void updateFoodEntry(updated); loadData(); };

  const handleSaveTemplate = (name: string) => {
    if (!templateSource) return;
    const items = grouped[templateSource] ?? [];
    if (items.length > 0) {
      const tmpl: MealTemplate = {
        id: crypto.randomUUID(),
        name,
        mealType: templateSource,
        items: items.map((e) => ({
          name: e.name, calories: e.calories, protein: e.protein, fat: e.fat, carbs: e.carbs,
        })),
        createdAt: new Date().toISOString(),
      };
      void saveMealTemplate(tmpl);
      setTemplateToast(true);
      setTimeout(() => setTemplateToast(false), 1500);
    }
    setTemplateSource(null);
  };

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


  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      {/* ── Header ─────────────────────────────── */}
      <div className="pt-6 pb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-fg tracking-tight">
          {t.weeklyLog} 📅
        </h1>
        {/* 週間 / トレンド segmented toggle */}
        <div role="tablist" aria-label={t.weeklyLog} className="flex p-1 bg-surface-2 rounded-2xl">
          {([['weekly', t.weeklyTab], ['month', t.monthTab], ['trends', t.trendsTab]] as const).map(([v, label]) => (
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

      {view === 'month' && <MonthCalendar daySets={daySets} onSelectDay={jumpToDay} />}

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
                    ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_4px_12px_rgba(88,204,2,0.35)]'
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
        {goals ? (
          <CalorieBar current={totals.calories} goal={goals.calories} />
        ) : (
          <p className="text-lg font-black text-fg tabular-nums">
            {totals.calories.toLocaleString()} <span className="text-xs font-bold text-faint">kcal</span>
          </p>
        )}
        <div className="flex gap-3 mt-3 text-xs font-semibold">
          <span className="text-brand-600 dark:text-brand-400">P {totals.protein}g</span>
          <span className="text-warning">F {totals.fat}g</span>
          <span className="text-blue-600 dark:text-blue-400">C {totals.carbs}g</span>
        </div>
      </div>

      {/* ── Daily entries ─────────────────────────── */}
      {selectedEntries.length === 0 ? (
        <div className={`${cardCls} p-10 text-center mb-4`}>
          <p className="text-4xl mb-3" aria-hidden="true">📋</p>
          <p className="text-sm font-semibold text-faint mb-4">{t.noData}</p>
          <Link
            href="/add"
            className="
              inline-flex items-center justify-center
              px-5 py-2.5 rounded-2xl
              bg-gradient-to-br from-brand-500 to-brand-600 text-white
              text-sm font-bold shadow-card
              hover:scale-[1.03] active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              transition-all duration-200
            "
          >
            {t.noMealsCta}
          </Link>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          {MEAL_TYPES.map((type) => {
            const typeEntries = grouped[type];
            if (typeEntries.length === 0) return null;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <h3 className="text-xs font-black text-faint uppercase tracking-widest">
                    {MEAL_LABELS[type]}
                  </h3>
                  <button
                    onClick={() => setTemplateSource(type)}
                    aria-label={`${MEAL_LABELS[type]}: ${t.saveMealTemplateLabel}`}
                    className="flex items-center gap-1 text-xs font-bold text-faint hover:text-brand transition-colors rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    <BookmarkPlus size={12} aria-hidden />
                    {t.saveMealTemplateLabel}
                  </button>
                </div>
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

      {/* ── SUS usability survey (Day14+, authenticated only) ───── */}
      <SusSurveyCard />

      </>
      )}

      <ConfirmDialog
        open={templateSource != null}
        title={t.saveMealTemplateLabel}
        confirmLabel={t.saveLabel}
        cancelLabel={t.cancel}
        input={{ label: t.templateNameLabel }}
        onConfirm={handleSaveTemplate}
        onCancel={() => setTemplateSource(null)}
      />
      <Toast message={templateToast ? `✓ ${t.templateSavedToast}` : null} />

      <BottomNav />
    </div>
  );
}
