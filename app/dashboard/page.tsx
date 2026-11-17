'use client';

/**
 * Home — the core loop on one screen (ADR-011):
 *   today's kcal vs goal → today's meals → one-tap weight → recommendation
 *   → water → push opt-in.
 *
 * Gamification (XP / rank / quests / badges / streak UI), AI cards, TDEE,
 * steps and health-log cards were deleted; see
 * docs/reviews/RADICAL_CRITIQUE_2026-11.md for the rationale and the
 * before/after measurements.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import {
  getAppData, removeFoodEntry, updateFoodEntry, addWater, getWaterForDate,
  addFoodEntry, getRealGoals,
} from '@/lib/data';
import { FoodEntry, DailyGoals } from '@/lib/types';
import MealCard from '@/components/MealCard';
import WaterTracker from '@/components/WaterTracker';
import QuickWeightCard from '@/components/QuickWeightCard';
import PushPermissionCard from '@/components/PushPermissionCard';
import RecommendationCard from '@/components/RecommendationCard';
import BottomNav from '@/components/BottomNav';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';
import { fmtMonthDayDowShortJa, shiftDate, todayJst } from '@/lib/format-date';
import { sumIntake } from '@/lib/macros';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const ICON_BTN = `
  w-11 h-11 rounded-2xl
  bg-card shadow-card border border-line
  flex items-center justify-center
  text-faint hover:text-fg
  active:scale-95
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
  transition-all duration-200
`;

export default function HomePage() {
  const { t } = useLanguage();
  const [entries, setEntries]   = useState<FoodEntry[]>([]);
  // null = "no real goals set" (un-onboarded / skip path) → empty-state card.
  const [goals, setGoals]       = useState<DailyGoals | null>(null);
  // Gates first paint so we never flash fabricated numbers OR the empty card
  // before the client-only data load resolves.
  const [goalsReady, setGoalsReady] = useState(false);
  const [water, setWater]       = useState(0);
  const [today]                 = useState(todayJst());
  const [collapsedMeals, setCollapsedMeals] = useState<Set<string>>(new Set());
  const [copyToast, setCopyToast]           = useState<string | null>(null);

  const loadData = () => {
    const data = getAppData();
    setEntries(data.foodEntries.filter((e) => e.date === today));
    setGoals(getRealGoals());
    setGoalsReady(true);
    setWater(getWaterForDate(today));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (id: string) => { void removeFoodEntry(id); loadData(); };
  const handleEdit   = (updated: FoodEntry) => { void updateFoodEntry(updated); loadData(); };

  const handleAddWater = async (ml: number) => {
    await addWater(today, ml);
    setWater(getWaterForDate(today));
  };

  const handleCopyYesterday = async () => {
    const yesterdayEntries = getAppData().foodEntries.filter((e) => e.date === shiftDate(today, -1));
    if (yesterdayEntries.length === 0) {
      setCopyToast(t.noYesterdayData);
      setTimeout(() => setCopyToast(null), 2000);
      return;
    }
    for (const entry of yesterdayEntries) {
      await addFoodEntry({ ...entry, id: crypto.randomUUID(), date: today, addedAt: new Date().toISOString() });
    }
    loadData();
    setCopyToast(t.copyYesterdayDone);
    setTimeout(() => setCopyToast(null), 2500);
  };

  const toggleMeal = (type: string) => {
    setCollapsedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  // P/F/C sums cover entered meals only; kcal-only meals are flagged (029).
  const totals = sumIntake(entries);
  const hasMacros = totals.enteredCount > 0;

  const remaining = goals ? Math.max(0, goals.calories - totals.calories) : 0;
  const over      = goals ? totals.calories > goals.calories : false;
  const pct       = goals && goals.calories > 0 ? Math.min(100, Math.round((totals.calories / goals.calories) * 100)) : 0;

  const grouped = MEAL_TYPES.reduce(
    (acc, type) => { acc[type] = entries.filter((e) => e.mealType === type); return acc; },
    {} as Record<string, FoodEntry[]>,
  );

  const MEAL_LABELS: Record<string, string> = {
    breakfast: `🌅 ${t.breakfast}`,
    lunch:     `☀️ ${t.lunch}`,
    dinner:    `🌙 ${t.dinner}`,
    snack:     `🍎 ${t.snack}`,
  };

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      <Toast message={copyToast} variant="neutral" />

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight">{t.appName}</h1>
          <p className="text-xs text-faint mt-0.5 font-medium">{fmtMonthDayDowShortJa(today)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleCopyYesterday()}
            title={t.copyYesterdayDesc}
            aria-label={t.copyYesterdayDesc}
            className={ICON_BTN}
          >
            <Copy size={16} aria-hidden="true" />
          </button>
          <Link href="/settings" aria-label={t.settings} className={ICON_BTN}>
            <Settings size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* ── 1. Today's kcal vs goal ─────────────────── */}
      {goalsReady && (goals ? (
        <div className={`
          rounded-2xl p-5 mb-3 shadow-elevated
          ${over ? 'bg-gradient-to-br from-amber-500 to-red-600' : 'bg-gradient-to-br from-brand-500 to-brand-600'}
        `}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/85 mb-1">
            {over ? '⚠️ オーバー' : t.remaining}
          </p>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-black text-white tracking-tight leading-none tabular-nums">
              {over ? `+${(totals.calories - goals.calories).toLocaleString()}` : remaining.toLocaleString()}
            </span>
            <span className="text-lg text-white/85 font-medium mb-1">kcal</span>
          </div>
          <div
            className="h-2 rounded-full bg-white/25 overflow-hidden mb-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={t.consumed}
          >
            <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-white/80 font-medium tabular-nums">
            {totals.calories.toLocaleString()} / {goals.calories.toLocaleString()} kcal {t.consumed}
            {hasMacros && (
              <span className="ml-2">
                · P {Math.round(totals.protein)}g · F {Math.round(totals.fat)}g · C {Math.round(totals.carbs)}g
                {totals.kcalOnlyCount > 0 && ` ${t.macrosPartialNote}`}
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-card border border-line p-6 text-center mb-3">
          <p className="text-sm font-semibold text-muted">{t.noGoalsTitle}</p>
          <p className="text-xs text-faint mt-1 mb-4">{t.noGoalsSub}</p>
          <Button href="/onboarding" size="lg">{t.noGoalsCta}</Button>
          <div className="mt-3">
            <Link href="/settings" className="text-xs text-faint underline underline-offset-2 hover:text-fg transition-colors">
              {t.noGoalsSettingsLink}
            </Link>
          </div>
        </div>
      ))}

      {/* ── 2. Today's meals ───────────────────────── */}
      <h2 className="text-sm font-bold text-muted mb-2 mt-1">{t.todayMeals}</h2>

      {entries.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-card border border-line p-6 text-center mb-3">
          <p className="text-sm font-semibold text-muted">{t.noMeals}</p>
          <p className="text-xs text-faint mt-1 mb-4">{t.noMealsSub}</p>
          <Button href="/add" size="lg">{t.noMealsCta}</Button>
        </div>
      ) : (
        <div className="space-y-3 mb-3">
          {MEAL_TYPES.map((type) => {
            const typeEntries = grouped[type];
            if (typeEntries.length === 0) return null;
            const sectionCals = typeEntries.reduce((s, e) => s + e.calories, 0);
            const collapsed = collapsedMeals.has(type);
            return (
              <div key={type} className="bg-card rounded-2xl shadow-card border border-line overflow-hidden">
                <button
                  onClick={() => toggleMeal(type)}
                  aria-expanded={!collapsed}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {collapsed
                      ? <ChevronRight size={14} className="text-faint" aria-hidden="true" />
                      : <ChevronDown size={14} className="text-faint" aria-hidden="true" />}
                    <span className="text-xs font-black text-faint uppercase tracking-widest">
                      {MEAL_LABELS[type]}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-faint tabular-nums">
                    {sectionCals.toLocaleString()} kcal
                  </span>
                </button>
                {!collapsed && (
                  <div className="px-3 pb-3 space-y-2">
                    {typeEntries.map((entry) => (
                      <MealCard key={entry.id} entry={entry} onDelete={handleDelete} onEdit={handleEdit} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. One-tap weight ──────────────────────── */}
      <QuickWeightCard />

      {/* ── 4. Safe recommendation (thesis artifact) ─ */}
      <RecommendationCard />

      {/* ── 5. Water ───────────────────────────────── */}
      <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
        <WaterTracker current={water} goal={goals?.water ?? 2000} onAdd={handleAddWater} />
      </div>

      {/* ── Web Push opt-in (authed users, sticky dismissal) ── */}
      <PushPermissionCard />

      <BottomNav />
    </div>
  );
}
