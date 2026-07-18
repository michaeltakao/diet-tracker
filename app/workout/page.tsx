'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  getAppData, addWorkoutEntry, removeWorkoutEntry,
  checkAndUpdatePR, addBadge, checkAndAwardBadges, getStreak, getBadges,
  getHealthProfile, getRealGoals,
} from '@/lib/data';
import { WorkoutEntry, MusclePart, CoachMenu, FoodEntry, Badge, PersonalRecord, DailyGoals, SetDetail } from '@/lib/types';
import {
  Dumbbell, Clock, Flame, ShieldAlert, CheckCircle,
  Trash2, ChevronRight, ChevronDown, Sparkles, X,
} from 'lucide-react';
import { getExercises } from '@/lib/exercise-db';
import { summarizeSets, nextSetSuggestion } from '@/lib/workout-sets';
import BottomNav from '@/components/BottomNav';
import { Toast } from '@/components/ui/Toast';
import BadgeCelebration from '@/components/BadgeCelebration';
import BadgeShelf from '@/components/BadgeShelf';
import MedWarning from '@/components/MedWarning';
import RestTimer from '@/components/RestTimer';
import { getWorkoutWarnings } from '@/lib/medication-rules';
import { isSupabaseConfigured } from '@/lib/supabase';
import { postJson } from '@/lib/httpClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeightUnit, toDisplay, lbsToKg, formatWeight } from '@/lib/units';
import { epley1RM } from '@/lib/onerm';

// The curated starter menus now live in lib/exercise-db.ts (phase B); this
// adapter keeps the CoachMenu shape so the rendering below stays unchanged.
// nameJa remains the canonical logging name (history/PR back-compat).
const RECOMMENDED_MENUS: CoachMenu[] = getExercises()
  .filter((e) => e.recommended)
  .map((e) => ({
    id: e.id,
    name: e.nameJa,
    musclePart: e.musclePart,
    defaultWeight: e.recommended!.defaultWeightKg,
    defaultReps: e.recommended!.reps,
    defaultSets: e.recommended!.sets,
    coachTip: e.recommended!.coachTipJa,
    coachTipEn: e.recommended!.coachTipEn,
  }));

const PART_IDS: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

interface CoachAdvice {
  todayAdvice: string;
  habitInsight: string;
  tomorrowTip: string;
  motivationMessage: string;
}

function getTodayDate() { return new Date().toISOString().split('T')[0]; }

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function buildTimestamp(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const dt = new Date(`${date}T00:00:00`);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '--:--'; }
}

/** Days since the given muscle group was last trained (null = no history). */
function getDaysSinceGroup(musclePart: MusclePart, workouts: WorkoutEntry[]): number | null {
  const relevant = workouts.filter(w => w.musclePart === musclePart);
  if (relevant.length === 0) return null;
  const latest = relevant.reduce((a, b) => a.date > b.date ? a : b);
  return Math.floor((Date.now() - new Date(latest.date + 'T00:00:00').getTime()) / 86_400_000);
}

/** Last completed session for a specific exercise (excludes today). */
function getLastSession(name: string, workouts: WorkoutEntry[], today: string): {
  weight: number; reps: number; sets: number; daysAgo: number;
} | null {
  const prev = workouts
    .filter(w => w.name === name && w.date < today && (w.weight ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (prev.length === 0) return null;
  const last = prev[0];
  const daysAgo = Math.floor((Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 86_400_000);
  return { weight: last.weight ?? 0, reps: last.reps ?? 0, sets: last.sets ?? 0, daysAgo };
}

/**
 * Progressive overload suggestion: if last session hit ≥ 12 reps, add 2.5 kg.
 * Falls back to defaultWeight when no history.
 */
function suggestWeight(last: { weight: number; reps: number } | null, defaultWeight: number): number {
  if (!last || last.weight === 0) return defaultWeight;
  return last.reps >= 12 ? last.weight + 2.5 : last.weight;
}

// ── Skeleton for AI coach loading ────────────────────
function CoachSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[['1/4', 'full'], ['full', '3/4'], ['full', '2/3'], ['1/3', 'full']].map(([w1, w2], i) => (
        <div key={i} className="rounded-2xl p-3 bg-surface-2">
          <div className={`h-2.5 skeleton rounded w-${w1} mb-2`} />
          <div className={`h-4 skeleton rounded w-${w2} mb-1`} />
          <div className="h-4 skeleton rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function WorkoutPage() {
  const today = getTodayDate();
  const { t, lang } = useLanguage();
  const { unit } = useWeightUnit();
  /** Parse the weight input (shown in the display unit) back into kg for storage. */
  const toKg = (displayVal: number) => (unit === 'lbs' ? Math.round(lbsToKg(displayVal) * 10) / 10 : displayVal);

  const PARTS = PART_IDS.map(id => ({
    id,
    label: t[`mp${id.charAt(0).toUpperCase()}${id.slice(1)}` as 'mpChest'],
  }));

  const [workouts, setWorkouts]           = useState<WorkoutEntry[]>([]);
  const [foodEntries, setFoodEntries]     = useState<FoodEntry[]>([]);
  const [selectedPart, setSelectedPart]  = useState<MusclePart>('chest');
  const [name, setName]                  = useState('');
  const [musclePart, setMusclePart]      = useState<MusclePart>('chest');
  const [weight, setWeight]              = useState('40');
  const [reps, setReps]                  = useState('10');
  const [sets, setSets]                  = useState('3');
  // Per-set mode (phase B): rows are strings in the DISPLAY unit; storage kg.
  const [detailMode, setDetailMode]      = useState(false);
  const [setRows, setSetRows]            = useState<Array<{ weight: string; reps: string }>>([]);
  const [logTime, setLogTime]            = useState(getCurrentTime());
  const [coachAdvice, setCoachAdvice]    = useState(t.defaultCoachTip);
  const [allBadges, setAllBadges]        = useState<Badge[]>([]);
  const [pickerOpen, setPickerOpen]      = useState(false);

  // AI coach
  const [aiAdvice, setAiAdvice]    = useState<CoachAdvice | null>(null);
  const [aiLoading, setAiLoading]  = useState(false);
  const [aiError, setAiError]      = useState('');

  // PR & Badge celebration
  const [celebrationBadges, setCelebrationBadges] = useState<Badge[]>([]);
  const [prToast, setPrToast]                     = useState<string | null>(null);

  // History for smart recommendations
  const [allWorkouts,    setAllWorkouts]    = useState<WorkoutEntry[]>([]);
  const [personalRecords, setPersonalRecords] = useState<Record<string, PersonalRecord>>({});
  const [workoutWarnings, setWorkoutWarnings] = useState<string[]>([]);
  // null = no real goals → AI coach is gated (P0 #4b: no fabricated goals to the LLM).
  const [realGoals, setRealGoals] = useState<DailyGoals | null>(null);

  // Entry form anchor for the empty-timeline CTA (#5).
  const entryFormRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(() => {
    const data = getAppData();
    setWorkouts(data.workoutEntries.filter((w) => w.date === today));
    setFoodEntries(data.foodEntries.filter((f) => f.date === today));
    setAllBadges(getBadges());
    setAllWorkouts(data.workoutEntries);
    setPersonalRecords(data.personalRecords ?? {});
    setRealGoals(getRealGoals());
    const profile = getHealthProfile();
    setWorkoutWarnings(getWorkoutWarnings(profile.healthConditions, profile.medications ?? []));
  }, [today]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!prToast) return;
    const t = setTimeout(() => setPrToast(null), 3000);
    return () => clearTimeout(t);
  }, [prToast]);

  /** Last previous session's per-set breakdown for an exercise (ghost text). */
  const getLastSetDetails = (exerciseName: string): SetDetail[] | null => {
    const prev = allWorkouts
      .filter((w) => w.name === exerciseName && w.date < today && (w.setDetails?.length ?? 0) > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    return prev[0]?.setDetails ?? null;
  };

  /** Seed the per-set rows from the current scalar fields. */
  const seedRowsFromScalars = (w: string, r: string, s: string) => {
    const n = Math.min(10, Math.max(1, parseInt(s) || 3));
    setSetRows(Array.from({ length: n }, () => ({ weight: w, reps: r })));
  };

  const handleSelectMenu = (menu: CoachMenu) => {
    const last      = getLastSession(menu.name, allWorkouts, today);
    const suggested = suggestWeight(last, menu.defaultWeight);
    setName(menu.name);
    setMusclePart(menu.musclePart);
    // Form weight is shown in the user's display unit; storage stays kg.
    const w = String(toDisplay(suggested, unit));
    setWeight(w);
    setReps(String(menu.defaultReps));
    setSets(String(menu.defaultSets));
    if (detailMode) seedRowsFromScalars(w, String(menu.defaultReps), String(menu.defaultSets));
    setCoachAdvice(lang === 'en' && menu.coachTipEn ? menu.coachTipEn : menu.coachTip);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Per-set mode: rows (display unit) → kg SetDetails; scalars derived via
    // summarizeSets so every existing reader keeps its semantics.
    let wt: number, repCount: number, setCount: number;
    let setDetails: SetDetail[] | undefined;
    let est1RM: number;
    if (detailMode) {
      const details = setRows
        .map((r) => ({ weight: toKg(parseFloat(r.weight) || 0), reps: parseInt(r.reps) || 0 }))
        .filter((s) => s.reps > 0 && s.weight >= 0);
      const summary = summarizeSets(details);
      if (summary.sets === 0) return;
      wt = summary.weight;
      repCount = summary.reps;
      setCount = summary.sets;
      est1RM = summary.best1RM;
      setDetails = details;
    } else {
      wt = toKg(parseFloat(weight) || 0);
      repCount = parseInt(reps) || 0;
      setCount = parseInt(sets) || 0;
      est1RM = epley1RM(wt, repCount);
    }

    const isNewPR = await checkAndUpdatePR(name.trim(), wt, today, est1RM);

    await addWorkoutEntry({
      id: crypto.randomUUID(),
      date: today,
      name: name.trim(),
      category: 'strength',
      musclePart,
      weight: wt,
      reps:   repCount,
      sets:   setCount,
      ...(setDetails ? { setDetails } : {}),
      addedAt: buildTimestamp(today, logTime),
    });

    if (isNewPR && wt > 0) {
      const prBadge: Badge = {
        id: crypto.randomUUID(),
        type: 'pr_achieved',
        name: `💪 ${name.trim()} ${t.prNewRecord}`,
        description: lang === 'en'
          ? `New personal record on ${name.trim()}: ${formatWeight(wt, unit)}!`
          : `${name.trim()} で ${formatWeight(wt, unit)} の自己ベストを更新しました！`,
        icon: '💪',
        earnedAt: new Date().toISOString(),
      };
      await addBadge(prBadge);
      setPrToast(`🏆 PR更新！${name.trim()} ${formatWeight(wt, unit)}`);
      setCelebrationBadges([prBadge]);
    }

    const newBadges = await checkAndAwardBadges(today);
    if (newBadges.length > 0 && !isNewPR) setCelebrationBadges(newBadges);

    loadData();
    setName('');
    setLogTime(getCurrentTime());
  };

  const handleDelete = (id: string) => { removeWorkoutEntry(id); loadData(); };

  const handleGetAIAdvice = async () => {
    if (!realGoals) return; // gated in the UI; never send fabricated goals to the LLM
    setAiLoading(true);
    setAiError('');
    try {
      const data = getAppData();
      const todayFood = data.foodEntries.filter((e) => e.date === today);
      const totals = todayFood.reduce(
        (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, fat: acc.fat + e.fat, carbs: acc.carbs + e.carbs }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );
      const recentFoodLog = [...data.foodEntries]
        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
        .slice(0, 14)
        .map((f) => ({ date: f.date, time: formatTime(f.addedAt), name: f.name, calories: f.calories, mealType: f.mealType }));
      const recentWorkoutLog = [...data.workoutEntries]
        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
        .slice(0, 10)
        .map((w) => ({ date: w.date, name: w.name, weight: w.weight ?? 0 }));

      const advice = await postJson<CoachAdvice>('/api/coach', {
        today, ...totals,
        calorieGoal: realGoals.calories, proteinGoal: realGoals.protein,
        fatGoal: realGoals.fat, carbsGoal: realGoals.carbs,
        waterConsumed: data.waterByDate[today] ?? 0, waterGoal: realGoals.water ?? 2000,
        todayWorkouts: workouts.map((w) => ({ name: w.name, weight: w.weight ?? 0, reps: w.reps ?? 0, sets: w.sets ?? 0 })),
        recentFoodLog, recentWorkoutLog, streak: getStreak(),
        healthConditions: getHealthProfile().healthConditions,
        medications: getHealthProfile().medications ?? [],
      });
      setAiAdvice(advice);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setAiLoading(false);
    }
  };

  const timeline = [
    ...foodEntries.map((f) => ({ ...f, _type: 'food' as const })),
    ...workouts.map((w)    => ({ ...w, _type: 'workout' as const })),
  ].sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());

  const cardCls = 'bg-card rounded-2xl p-4 shadow-card border border-line';

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28 lg:pb-8 max-w-md lg:max-w-2xl mx-auto lg:px-6">
      {/* Badge Celebration */}
      {celebrationBadges.length > 0 && (
        <BadgeCelebration badges={celebrationBadges} onClose={() => setCelebrationBadges([])} />
      )}

      {/* PR Toast */}
      <Toast message={prToast} variant="celebrate" />

      {/* Header */}
      <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 text-white px-4 pt-12 pb-8 rounded-b-[2.5rem] shadow-[0_16px_48px_rgba(88,204,2,0.25)]">
        <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
          <Dumbbell className="w-6 h-6" /> {t.aiCoach}
        </h1>
        <p className="text-green-100 text-sm mt-1 font-medium">{t.workoutSubtitle}</p>
      </div>

      {/* Med / condition workout warnings */}
      {workoutWarnings.length > 0 && (
        <div className="px-4 mt-4">
          <MedWarning warnings={workoutWarnings} type="workout" collapseAfter={2} />
        </div>
      )}

      <div className="px-4 pt-5 space-y-4">

        {/* 1 ── 部位別メニュー ─────────────── */}
        <section className={`${cardCls} space-y-3`}>
          <h2 className="font-black text-fg flex items-center gap-1.5">
            <Flame className="w-5 h-5 text-orange-500" /> {t.recommendedByGroup}
          </h2>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {PARTS.map((p) => {
              const days = getDaysSinceGroup(p.id, allWorkouts);
              const recoveryDot =
                days === null  ? null :
                days === 0     ? <span className="block text-[9px] font-bold leading-none text-red-400/90">{t.todayShort}</span> :
                days === 1     ? <span className="block text-[9px] font-bold leading-none text-amber-400">{lang === 'en' ? '1d ago' : '1日前'}</span> :
                                 <span className="block text-[9px] font-bold leading-none text-brand-400">{lang === 'en' ? `${days}d ago` : `${days}日前`}</span>;
              return (
                <button key={p.id} type="button" onClick={() => setSelectedPart(p.id)}
                  className={`
                    flex flex-col items-center px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap
                    transition-all duration-200 hover:scale-[1.04] active:scale-95
                    ${selectedPart === p.id
                      ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(88,204,2,0.35)]'
                      : 'bg-surface-2 text-muted'}
                  `}
                >
                  {p.label}
                  {recoveryDot}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            {RECOMMENDED_MENUS.filter((m) => m.musclePart === selectedPart).map((menu) => {
              const last      = getLastSession(menu.name, allWorkouts, today);
              const suggested = suggestWeight(last, menu.defaultWeight);
              const pr        = personalRecords[menu.name];
              const isOverload = last && suggested > last.weight;
              return (
                <button key={menu.id} type="button" onClick={() => handleSelectMenu(menu)}
                  className="
                    w-full text-left
                    bg-surface-2
                    hover:bg-green-50 dark:hover:bg-green-900/20
                    border border-line
                    hover:border-green-200 dark:hover:border-green-800
                    rounded-2xl p-3
                    flex items-center justify-between
                    transition-all duration-200
                    hover:scale-[1.01] active:scale-[0.99]
                    group
                  "
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-fg group-hover:text-brand-600 dark:group-hover:text-brand-400">{menu.name}</p>
                      {pr && (
                        <span className="text-[9px] font-black bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">
                          🏆 PR {formatWeight(pr.maxWeight, unit)}
                        </span>
                      )}
                    </div>
                    {last ? (
                      <div className="mt-0.5 space-y-0.5">
                        <p className="text-[11px] text-faint">
                          {t.lastSessionPrefix} <span className="text-muted font-semibold">{formatWeight(last.weight, unit)} × {last.reps}{lang === 'en' ? ' reps' : '回'} × {last.sets}set</span>
                          <span className="ml-1 text-faint">{last.daysAgo === 0 ? t.todayShort : lang === 'en' ? `${last.daysAgo}d ago` : `${last.daysAgo}日前`}</span>
                        </p>
                        <p className="text-[11px]">
                          <span className={isOverload ? 'text-brand-600 dark:text-brand-400 font-black' : 'text-faint font-semibold'}>
                            → {formatWeight(suggested, unit)} × {menu.defaultReps}回 × {menu.defaultSets}set
                          </span>
                          {isOverload && (
                            <span className="ml-1 text-[9px] font-bold bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 px-1.5 py-0.5 rounded-full">
                              +{toDisplay(suggested - last.weight, unit)}{unit} UP
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-0.5 font-semibold">
                        ✨ {t.firstChallengeLabel} — {menu.defaultWeight > 0 ? formatWeight(menu.defaultWeight, unit) : t.bodyweightLabel} × {menu.defaultReps}{lang === 'en' ? ' reps' : '回'}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-faint flex-shrink-0 ml-2" />
                </button>
              );
            })}
          </div>

          {/* Full exercise DB picker (phase B) — non-recommended for this part */}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            className="w-full flex items-center justify-between text-xs font-bold text-faint hover:text-fg py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
          >
            <span>{t.exercisePickerTitle}</span>
            {pickerOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {pickerOpen && (
            <div className="grid grid-cols-2 gap-1.5">
              {getExercises(selectedPart).filter((e) => !e.recommended).map((ex) => {
                const equipLabel = {
                  barbell: t.equipBarbell, dumbbell: t.equipDumbbell, machine: t.equipMachine,
                  cable: t.equipCable, bodyweight: t.equipBodyweight,
                }[ex.equipment];
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      const last = getLastSession(ex.nameJa, allWorkouts, today);
                      const suggested = suggestWeight(last, 0);
                      setName(ex.nameJa);
                      setMusclePart(ex.musclePart);
                      const w = String(toDisplay(suggested, unit));
                      setWeight(w);
                      setReps('10');
                      setSets('3');
                      if (detailMode) seedRowsFromScalars(w, '10', '3');
                      setCoachAdvice(t.defaultCoachTip);
                    }}
                    className="
                      text-left bg-surface-2 border border-line rounded-xl px-2.5 py-2
                      hover:bg-green-50 dark:hover:bg-green-900/20
                      hover:border-green-200 dark:hover:border-green-800
                      transition-all duration-200 active:scale-[0.98]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                    "
                  >
                    <p className="text-xs font-bold text-fg leading-tight">
                      {lang === 'en' ? ex.nameEn : ex.nameJa}
                    </p>
                    <span className="text-[9px] font-semibold text-faint">{equipLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 2 ── 入力フォーム ──────────────── */}
        <section ref={entryFormRef} className={`${cardCls} space-y-4`}>
          {/* Coach tip */}
          <div className="bg-gradient-to-r from-green-50 to-brand-50 dark:from-green-900/20 dark:to-brand-900/20 rounded-2xl p-3 border border-green-100 dark:border-green-800 flex gap-2 items-start">
            <ShieldAlert className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed font-medium">{coachAdvice}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.workoutName}</label>
              <input ref={nameInputRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ベンチプレス、スクワットなど"
                className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-3 py-2.5 text-fg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400" />
            </div>

            {/* Log time */}
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.selectLogTime}</label>
              <input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)}
                className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-3 py-2.5 text-fg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400" />
            </div>

            {/* Per-set mode toggle (phase B) */}
            <button
              type="button"
              onClick={() => {
                const next = !detailMode;
                setDetailMode(next);
                if (next && setRows.length === 0) seedRowsFromScalars(weight, reps, sets);
              }}
              aria-pressed={detailMode}
              className={`
                text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all
                ${detailMode
                  ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
                  : 'border-line-strong text-faint hover:border-line-strong'}
              `}
            >
              {t.setDetailToggle}
            </button>

            {!detailMode ? (
              <div className="grid grid-cols-3 gap-2">
                {([
                  [lang === 'en' ? `Weight (${unit})` : `重量 (${unit})`, weight, setWeight],
                  [t.reps, reps, setReps],
                  [t.sets, sets, setSets],
                ] as const).map(([label, val, setter]) => (
                  <div key={label}>
                    <label className="block text-xs font-bold text-faint uppercase tracking-wide mb-1">{label}</label>
                    <input type="number" value={val} aria-label={label}
                      onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                      className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-2 py-2.5 text-center text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
                  </div>
                ))}
              </div>
            ) : (
              /* Per-set rows: ±2.5 steppers (display unit), ghost = last session */
              (() => {
                const ghost = name.trim() ? getLastSetDetails(name.trim()) : null;
                return (
                  <div className="space-y-2">
                    {setRows.map((row, i) => {
                      const g = ghost?.[i];
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-faint w-10 shrink-0 uppercase tracking-wide">
                            {t.setLabel}{i + 1}
                          </span>
                          <button type="button" aria-label={`-2.5 ${unit}`}
                            onClick={() => setSetRows((rows) => rows.map((r, j) => j === i
                              ? { ...r, weight: String(Math.max(0, Math.round(((parseFloat(r.weight) || 0) - 2.5) * 10) / 10)) } : r))}
                            className="w-8 h-9 rounded-lg border border-line-strong text-faint font-bold hover:bg-surface-2 transition-colors shrink-0">−</button>
                          <input
                            type="number" inputMode="decimal" value={row.weight}
                            placeholder={g ? String(toDisplay(g.weight, unit)) : '0'}
                            aria-label={`${t.setLabel}${i + 1} ${lang === 'en' ? 'weight' : '重量'} (${unit})`}
                            onChange={(e) => setSetRows((rows) => rows.map((r, j) => j === i ? { ...r, weight: e.target.value } : r))}
                            className="w-full min-w-0 text-sm bg-surface-2 border border-line-strong rounded-xl px-1 py-2 text-center text-fg placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          />
                          <button type="button" aria-label={`+2.5 ${unit}`}
                            onClick={() => setSetRows((rows) => rows.map((r, j) => j === i
                              ? { ...r, weight: String(Math.round(((parseFloat(r.weight) || 0) + 2.5) * 10) / 10) } : r))}
                            className="w-8 h-9 rounded-lg border border-line-strong text-faint font-bold hover:bg-surface-2 transition-colors shrink-0">＋</button>
                          <span className="text-[10px] text-faint shrink-0">{unit}</span>
                          <input
                            type="number" inputMode="numeric" value={row.reps}
                            placeholder={g ? String(g.reps) : '0'}
                            aria-label={`${t.setLabel}${i + 1} ${t.reps}`}
                            onChange={(e) => setSetRows((rows) => rows.map((r, j) => j === i ? { ...r, reps: e.target.value } : r))}
                            className="w-16 shrink-0 text-sm bg-surface-2 border border-line-strong rounded-xl px-1 py-2 text-center text-fg placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          />
                          <span className="text-[10px] text-faint shrink-0">{lang === 'en' ? 'reps' : '回'}</span>
                          <button type="button" aria-label={`${t.removeSet} ${i + 1}`}
                            onClick={() => setSetRows((rows) => rows.filter((_, j) => j !== i))}
                            className="p-1.5 text-faint hover:text-red-400 transition-colors shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSetRows((rows) => {
                        const prev = rows[rows.length - 1];
                        const parsed = prev
                          ? { weight: toKg(parseFloat(prev.weight) || 0), reps: parseInt(prev.reps) || 0 }
                          : null;
                        const s = nextSetSuggestion(parsed && parsed.reps > 0 ? parsed : null, 0);
                        return [...rows, {
                          weight: s.weight > 0 ? String(toDisplay(s.weight, unit)) : (prev?.weight ?? ''),
                          reps: s.reps > 0 ? String(s.reps) : (prev?.reps ?? ''),
                        }];
                      })}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-surface-2 text-muted hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    >
                      {t.addSet}
                    </button>
                  </div>
                );
              })()
            )}

            {/* Live estimated 1RM (Epley) — per-set mode uses the best set */}
            {(() => {
              const orm = detailMode
                ? summarizeSets(setRows.map((r) => ({ weight: toKg(parseFloat(r.weight) || 0), reps: parseInt(r.reps) || 0 }))).best1RM
                : epley1RM(toKg(parseFloat(weight) || 0), parseInt(reps) || 0);
              if (orm <= 0) return null;
              return (
                <p className="text-[11px] text-faint text-right" aria-live="polite">
                  {t.est1rmPr}:{' '}
                  <span className="font-black text-brand-600 dark:text-brand-400 tabular-nums">{formatWeight(orm, unit)}</span>
                </p>
              );
            })()}

            <button type="submit"
              className="
                w-full py-3.5 rounded-2xl font-black text-sm text-white
                bg-gradient-to-r from-brand-500 to-brand-600
                shadow-[0_4px_14px_rgba(88,204,2,0.4)]
                hover:from-brand-600 hover:to-brand-700
                hover:scale-[1.01] active:scale-[0.98]
                transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
              "
            >
              {t.recordWorkoutBtn}
            </button>
          </form>
        </section>

        {/* 2.5 ── Rest-interval timer ─────── */}
        <RestTimer />

        {/* 3 ── AI パーソナルコーチ ────────── */}
        <section className={`${cardCls} space-y-4`}>
          <h2 className="font-black text-fg flex items-center gap-1.5">
            <Sparkles className="w-5 h-5 text-purple-500" /> {t.aiCoach}
          </h2>
          <p className="text-xs text-faint">{t.aiCoachDesc}</p>

          {!isSupabaseConfigured() && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold text-purple-500 dark:text-purple-400">
                🔐 {t.loginForAI}
              </p>
            </div>
          )}

          {isSupabaseConfigured() && !aiAdvice && !aiLoading && !realGoals && (
            /* No real goals → set-goals CTA instead of the coach button (P0 #4b) */
            <div className="bg-surface-2 rounded-2xl p-5 text-center">
              <p className="text-2xl mb-2" aria-hidden="true">🎯</p>
              <p className="text-xs text-faint mb-3">{t.aiNeedsGoals}</p>
              <Link
                href="/onboarding"
                className="
                  inline-flex items-center justify-center
                  px-4 py-2 rounded-xl
                  bg-gradient-to-br from-brand-500 to-brand-600 text-white
                  text-xs font-bold shadow-card
                  hover:scale-[1.03] active:scale-95
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                  transition-all duration-200
                "
              >
                {t.noGoalsCta}
              </Link>
            </div>
          )}

          {isSupabaseConfigured() && !aiAdvice && !aiLoading && realGoals && (
            <button onClick={handleGetAIAdvice}
              className="
                w-full py-3.5
                bg-gradient-to-r from-purple-500 to-indigo-500
                hover:from-purple-600 hover:to-indigo-600
                text-white font-black rounded-2xl text-sm
                flex items-center justify-center gap-2
                shadow-[0_4px_14px_rgba(168,85,247,0.4)]
                hover:scale-[1.01] active:scale-[0.98]
                transition-all duration-200
              "
            >
              <Sparkles className="w-4 h-4" /> AIアドバイスを取得する
            </button>
          )}

          {aiLoading && <CoachSkeleton />}

          {aiError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-xl border border-red-100 dark:border-red-800">
              ⚠️ {aiError}
              <button onClick={handleGetAIAdvice} className="ml-2 underline font-semibold">{t.retry}</button>
            </div>
          )}

          {aiAdvice && (
            <div className="space-y-2.5 animate-fade-in">
              {/* Today's advice */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-3 border border-purple-100 dark:border-purple-800">
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1.5">📊 {t.todaySummaryLabel}</p>
                <p className="text-sm text-muted leading-relaxed">{aiAdvice.todayAdvice}</p>
              </div>
              {/* Habit insight */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-3 border border-blue-100 dark:border-blue-800">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1.5">🕐 {t.habitInsightLabel}</p>
                <p className="text-sm text-muted leading-relaxed">{aiAdvice.habitInsight}</p>
              </div>
              {/* Tomorrow tip */}
              <div className="bg-success-soft rounded-2xl p-3 border border-success/20">
                <p className="text-xs font-bold text-success mb-1.5">💡 {t.tomorrowAdviceLabel}</p>
                <p className="text-sm text-muted leading-relaxed">{aiAdvice.tomorrowTip}</p>
              </div>
              {/* Motivation */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-3 border border-yellow-100 dark:border-yellow-800 text-center">
                <p className="text-sm font-black text-yellow-700 dark:text-yellow-400">{aiAdvice.motivationMessage}</p>
              </div>
              <button onClick={() => { setAiAdvice(null); setAiError(''); }}
                className="w-full py-2 text-xs text-faint hover:text-fg underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                {t.refreshAdvice}
              </button>
            </div>
          )}
        </section>

        {/* 4 ── 習慣タイムライン ──────────── */}
        <section className={`${cardCls} space-y-3`}>
          <h2 className="font-black text-fg flex items-center gap-1.5">
            <Clock className="w-5 h-5 text-blue-500" /> {t.activityTimeline}
          </h2>
          <p className="text-xs text-faint">{t.activityTimelineDesc}</p>
          {timeline.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3" aria-hidden="true">💪</p>
              <p className="text-xs text-faint mb-4">{t.noTimelineEntries}</p>
              <button
                type="button"
                onClick={() => {
                  entryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  nameInputRef.current?.focus({ preventScroll: true });
                }}
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
                {t.noTimelineCta}
              </button>
            </div>
          ) : (
            <div className="relative border-l-2 border-line ml-3 pl-5 space-y-4 pt-1">
              {timeline.map((entry) => (
                <div key={entry.id} className="relative">
                  <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-card shadow-sm ${entry._type === 'food' ? 'bg-orange-400' : 'bg-green-500'}`} />
                  <span className="text-xs font-bold text-faint bg-surface-2 px-1.5 py-0.5 rounded mr-1">
                    {formatTime(entry.addedAt)}
                  </span>
                  <span className="text-sm font-semibold text-fg">
                    {entry._type === 'food' ? `🥗 ${(entry as FoodEntry).name}` : `🏋️ ${entry.name}`}
                  </span>
                  <p className="text-xs text-faint mt-0.5 pl-14">
                    {entry._type === 'food'
                      ? `${(entry as FoodEntry).calories}kcal · P${(entry as FoodEntry).protein}g · F${(entry as FoodEntry).fat}g · C${(entry as FoodEntry).carbs}g`
                      : `${formatWeight((entry as WorkoutEntry).weight ?? 0, unit)} × ${(entry as WorkoutEntry).reps}${lang === 'en' ? ' reps' : '回'} × ${(entry as WorkoutEntry).sets}set`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5 ── 実施済み ─────────────────── */}
        {workouts.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-black text-faint uppercase tracking-widest px-1">{t.completedSessions}</h3>
            {workouts.map((w) => (
              <div key={w.id} className="bg-card border border-line rounded-2xl p-3 flex items-center justify-between shadow-card hover:scale-[1.01] active:scale-[0.99] transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-fg">{w.name}</p>
                    <p className="text-xs text-faint">
                      {formatWeight(w.weight ?? 0, unit)} × {w.reps}{lang === 'en' ? ' reps' : '回'} × {w.sets}set
                      {epley1RM(w.weight ?? 0, w.reps ?? 0) > 0 && (
                        <span className="ml-1.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">· 1RM {formatWeight(epley1RM(w.weight ?? 0, w.reps ?? 0), unit)}</span>
                      )}
                    </p>
                    {/* Per-set breakdown + volume (phase B entries only) */}
                    {(w.setDetails?.length ?? 0) > 0 && (
                      <p className="text-[10px] text-faint mt-0.5 tabular-nums">
                        {w.setDetails!.map((s) => `${toDisplay(s.weight, unit)}×${s.reps}`).join(' / ')}
                        <span className="ml-1.5 font-semibold">
                          · {t.volumeLabel} {toDisplay(summarizeSets(w.setDetails!).volume, unit)}{unit}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(w.id)}
                  className="p-2 text-faint hover:text-red-400 active:scale-95 transition-all duration-200">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </section>
        )}

        {/* 6 ── Badge shelf ─────────────── */}
        {allBadges.length > 0 && (
          <section className={cardCls}>
            <BadgeShelf badges={allBadges} title={`🏆 ${t.myBadges} (${allBadges.length})`} />
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
