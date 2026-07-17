'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings, Flame, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import {
  getAppData, removeFoodEntry, updateFoodEntry, addWater, getWaterForDate, getStreakState,
  checkAndAwardBadges, getBadges, addFoodEntry, getRealGoals,
} from '@/lib/data';
import { FoodEntry, DailyGoals, Badge } from '@/lib/types';
import CalorieBar from '@/components/CalorieBar';
import PFCDonut from '@/components/PFCDonut';
import MacroBar from '@/components/MacroBar';
import MealCard from '@/components/MealCard';
import WaterTracker from '@/components/WaterTracker';
import BadgeShelf from '@/components/BadgeShelf';
import BadgeCelebration from '@/components/BadgeCelebration';
import WeeklyChallengeCard from '@/components/WeeklyChallengeCard';
import NudgeBanner from '@/components/NudgeBanner';
import PushPermissionCard from '@/components/PushPermissionCard';
import RecentSymptomsCard from '@/components/RecentSymptomsCard';
import RecommendationCard from '@/components/RecommendationCard';
import TdeeCard from '@/components/TdeeCard';
import BottomNav from '@/components/BottomNav';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/contexts/LanguageContext';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

import { fmtMonthDayDowShortJa } from '@/lib/format-date';

function formatDate(dateStr: string): string {
  return fmtMonthDayDowShortJa(dateStr);
}

export default function HomePage() {
  const { t } = useLanguage();
  const [entries, setEntries]   = useState<FoodEntry[]>([]);
  // null = "no real goals set" (un-onboarded / skip path) → empty-state card.
  // Typing as nullable forces every goal-render site into a guarded branch.
  const [goals, setGoals]       = useState<DailyGoals | null>(null);
  // Gates first paint so we never flash fabricated numbers OR the empty card
  // before the client-only data load resolves.
  const [goalsReady, setGoalsReady] = useState(false);
  const [water, setWater]       = useState(0);
  const [streak, setStreak]     = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [today]                 = useState(getTodayDate());
  const [celebrationBadges, setCelebrationBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges]           = useState<Badge[]>([]);
  const [collapsedMeals, setCollapsedMeals]       = useState<Set<string>>(new Set());
  const [copyToast, setCopyToast]                 = useState<string | null>(null);

  const loadData = () => {
    const data = getAppData();
    setEntries(data.foodEntries.filter((e) => e.date === today));
    setGoals(getRealGoals());
    setGoalsReady(true);
    setWater(getWaterForDate(today));
    const streakState = getStreakState();
    setStreak(streakState.current);
    setLongestStreak(streakState.longest);
    setEarnedBadges(getBadges());
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    loadData();
    void checkAndAwardBadges(getTodayDate()).then(newBadges => {
      if (newBadges.length > 0) setCelebrationBadges(newBadges);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (id: string) => { void removeFoodEntry(id); loadData(); };
  const handleEdit   = (updated: FoodEntry) => { void updateFoodEntry(updated); loadData(); };

  const handleAddWater = async (ml: number) => {
    await addWater(today, ml);
    setWater(getWaterForDate(today));
    const newBadges = await checkAndAwardBadges(today);
    if (newBadges.length > 0) { setCelebrationBadges(newBadges); setEarnedBadges(getBadges()); }
  };

  const handleCopyYesterday = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const data = getAppData();
    const yesterdayEntries = data.foodEntries.filter((e) => e.date === yesterdayStr);
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

  const totals = entries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, fat: acc.fat + e.fat, carbs: acc.carbs + e.carbs }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const remaining = goals ? Math.max(0, goals.calories - totals.calories) : 0;
  const over      = goals ? totals.calories > goals.calories : false;

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
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      {/* Badge Celebration */}
      {celebrationBadges.length > 0 && (
        <BadgeCelebration badges={celebrationBadges} onClose={() => setCelebrationBadges([])} />
      )}

      {/* Copy-yesterday toast */}
      <Toast message={copyToast} variant="neutral" />

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight">{t.appName}</h1>
          <p className="text-xs text-faint mt-0.5 font-medium">{formatDate(today)}</p>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div
              className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 px-2.5 py-1.5 rounded-2xl"
              title={`${t.longestStreak}: ${longestStreak}${t.streakDays}`}
            >
              <Flame size={13} className="text-orange-500" aria-hidden="true" />
              <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                {streak}{t.streakDays}
              </span>
            </div>
          )}
          <button
            onClick={() => void handleCopyYesterday()}
            title={t.copyYesterdayDesc}
            aria-label={t.copyYesterdayDesc}
            className="
              w-11 h-11 rounded-2xl
              bg-card shadow-card border border-line
              flex items-center justify-center
              text-faint
              hover:text-brand-600 dark:hover:text-brand-400
              hover:scale-[1.04] active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              transition-all duration-200
            "
          >
            <Copy size={16} aria-hidden="true" />
          </button>
          <Link
            href="/settings"
            aria-label={t.settings}
            className="
              w-11 h-11 rounded-2xl
              bg-card shadow-card border border-line
              flex items-center justify-center
              text-faint
              hover:text-fg
              hover:scale-[1.04] active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              transition-all duration-200
            "
          >
            <Settings size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* ── Streak nudge (max 1/day, dismissible) ───── */}
      <NudgeBanner />

      {/* ── Web Push opt-in (authed users, sticky dismissal) ───── */}
      <PushPermissionCard />

      {/* ── Goal-dependent section (real goals vs empty state) ───────────
          Gated on goalsReady so the first paint never flashes fabricated
          numbers or the empty card before the client-only load resolves. */}
      {goalsReady && (goals ? (
        <>
          {/* ── Hero calorie card ──────────────────────── */}
          <div className={`
            rounded-2xl p-5 mb-3
            ${over
              ? 'bg-gradient-to-br from-amber-500 to-red-600'
              : 'bg-gradient-to-br from-brand-500 to-brand-600'}
            shadow-elevated
          `}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/85 mb-1">
              {over ? '⚠️ オーバー' : t.remaining}
            </p>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-5xl font-black text-white tracking-tight leading-none tabular-nums">
                {over ? `+${(totals.calories - goals.calories).toLocaleString()}` : remaining.toLocaleString()}
              </span>
              <span className="text-lg text-white/85 font-medium mb-1">kcal</span>
            </div>
            <p className="text-xs text-white/75 font-medium tabular-nums">
              {totals.calories.toLocaleString()} / {goals.calories.toLocaleString()} kcal {t.consumed}
            </p>
          </div>

          {/* ── Calorie bar ─────────────────────────────── */}
          <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
            <CalorieBar current={totals.calories} goal={goals.calories} />
          </div>

          {/* ── PFC Donut ───────────────────────────────── */}
          <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
            <h2 className="text-sm font-bold text-muted mb-2">{t.macroBreakdown}</h2>
            <PFCDonut
              protein={totals.protein} fat={totals.fat} carbs={totals.carbs}
              goalProtein={goals.protein} goalFat={goals.fat} goalCarbs={goals.carbs}
            />
          </div>

          {/* ── Macro bars ──────────────────────────────── */}
          <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
            <h2 className="text-sm font-bold text-muted mb-3">{t.macros}</h2>
            <MacroBar
              protein={totals.protein} fat={totals.fat} carbs={totals.carbs}
              goalProtein={goals.protein} goalFat={goals.fat} goalCarbs={goals.carbs}
            />
          </div>
        </>
      ) : (
        /* ── Empty state: no real goals set ─────────────── */
        <div className="bg-card rounded-2xl shadow-card border border-line p-10 text-center mb-3">
          <p className="text-4xl mb-3" aria-hidden="true">🎯</p>
          <p className="text-sm font-semibold text-muted">{t.noGoalsTitle}</p>
          <p className="text-xs text-faint mt-1 mb-4">{t.noGoalsSub}</p>
          <Button href="/onboarding" size="lg">
            {t.noGoalsCta}
          </Button>
          <div className="mt-3">
            <Link
              href="/settings"
              className="text-xs text-faint underline underline-offset-2 hover:text-fg transition-colors"
            >
              {t.noGoalsSettingsLink}
            </Link>
          </div>
        </div>
      ))}

      {/* ── Personalized Recommendation ─────────────── */}
      <RecommendationCard />

      {/* ── Adaptive TDEE ───────────────────────────── */}
      <TdeeCard />

      {/* ── Water Tracker ───────────────────────────── */}
      <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
        <WaterTracker current={water} goal={goals?.water ?? 2000} onAdd={handleAddWater} />
      </div>

      {/* ── Weekly challenge (any-log, both goal states) ── */}
      <WeeklyChallengeCard />

      {/* ── Recent symptoms (renders only when any exist) ── */}
      <RecentSymptomsCard />

      {/* ── Badge shelf ─────────────────────────────── */}
      {earnedBadges.length > 0 && (
        <div className="bg-card rounded-2xl shadow-card border border-line p-4 mb-3">
          <BadgeShelf badges={earnedBadges} title="🏅 獲得バッジ" />
        </div>
      )}

      {/* ── Meal list ───────────────────────────────── */}
      <h2 className="text-sm font-bold text-muted mb-3 mt-1">{t.todayMeals}</h2>

      {entries.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-card border border-line p-10 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">🍽️</p>
          <p className="text-sm font-semibold text-muted">{t.noMeals}</p>
          <p className="text-xs text-faint mt-1 mb-4">{t.noMealsSub}</p>
          <Link
            href="/add"
            className="
              inline-flex items-center justify-center
              px-5 py-2.5 rounded-2xl
              bg-gradient-to-br from-brand-500 to-brand-600 text-white
              text-sm font-bold
              shadow-card hover:scale-[1.03] active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              transition-all duration-200
            "
          >
            {t.noMealsCta}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
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
                      : <ChevronDown size={14} className="text-faint" aria-hidden="true" />
                    }
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

      {/* ── FAB ─────────────────────────────────────── */}
      <Link
        href="/add"
        className="
          fixed bottom-20 right-4 z-40
          w-14 h-14 rounded-full
          bg-gradient-to-br from-brand-500 to-brand-600
          shadow-[0_8px_24px_rgba(88,204,2,0.5)]
          flex items-center justify-center text-white
          hover:scale-110 active:scale-95
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
          transition-all duration-200
        "
        aria-label={t.addMeal}
      >
        <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
      </Link>

      <BottomNav />
    </div>
  );
}
