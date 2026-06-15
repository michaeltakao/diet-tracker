'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  getAppData, addWorkoutEntry, removeWorkoutEntry,
  checkAndUpdatePR, addBadge, checkAndAwardBadges, getStreak, getBadges,
  getHealthProfile,
} from '@/lib/data';
import { getActiveProgram, getTodaySession } from '@/lib/data/training-plan';
import {
  WorkoutEntry, MusclePart, FoodEntry, Badge, PersonalRecord,
  TrainingProgram, PlannedExercise,
} from '@/lib/types';
import {
  Dumbbell, Clock, Flame, ShieldAlert, CheckCircle, Circle, CalendarCheck,
  Trash2, Plus, Minus, Sparkles,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
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
import { EXERCISES_BY_PART, type ExerciseDef } from '@/lib/exercise-catalog';
import { orderByRecency, resolveInitialSetValues } from '@/lib/workout-order';
import { plannedExerciseDefaults, getSessionProgress } from '@/lib/session-progress';

const PART_IDS: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

interface CoachAdvice {
  todayAdvice: string;
  habitInsight: string;
  tomorrowTip: string;
  motivationMessage: string;
}

import { todayLocal } from '@/lib/format-date';

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

/**
 * Most recent logged session for a specific exercise — the source for prefilling
 * the set editor.
 *
 * Includes *today* (`<= today`) so re-selecting an exercise right after logging
 * it pulls back the values just entered (the core "remember my last set" ask);
 * `daysAgo === 0` then renders as 今日. Ties on the same date are broken by
 * `addedAt` so the latest set of the day wins.
 *
 * Also includes bodyweight (weight 0) sessions so reps/sets prefill works for
 * moves like プランク/クランチ; weight stays safe because `suggestWeight`
 * independently falls back to the catalog default when the last load is 0.
 */
function getLastSession(name: string, workouts: WorkoutEntry[], today: string): {
  weight: number; reps: number; sets: number; daysAgo: number;
} | null {
  const prev = workouts
    .filter(w => w.name === name && w.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
  if (prev.length === 0) return null;
  const last = prev[0];
  const daysAgo = Math.floor((Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 86_400_000);
  return { weight: last.weight ?? 0, reps: last.reps ?? 0, sets: last.sets ?? 0, daysAgo };
}

// ── Stepper: editable numeric input flanked by ∓ buttons ──
interface StepperProps {
  /** Visible field label. */
  label: string;
  /** Accessible noun for the control and its ∓ buttons. */
  ariaLabel: string;
  /** Current value as a string (kept as string to mirror form state). */
  value: string;
  /** Increment/decrement amount, in the field's own unit. */
  step: number;
  /** Lower clamp bound (0 for weight, 1 for reps/sets). */
  min: number;
  onChange: (next: string) => void;
}

/**
 * Numeric stepper with editable centre input.
 *
 * The centre `<input type=number>` stays directly editable (typing is not
 * blocked); the ∓ buttons nudge by `step` and clamp to `min`. Values are rounded
 * to 0.1 so weight steps (e.g. ±2.5) never accumulate float dust.
 */
function Stepper({ label, ariaLabel, value, step, min, onChange }: StepperProps) {
  const clamp = (n: number) => Math.max(min, Math.round(n * 10) / 10);
  const current = Number.parseFloat(value);
  const base = Number.isFinite(current) ? current : min;
  const nudge = (delta: number) => onChange(String(clamp(base + delta)));

  return (
    <div>
      <label className="block text-xs font-bold text-faint uppercase tracking-wide mb-1">{label}</label>
      <div className="flex items-stretch rounded-xl border border-line-strong bg-surface-2 overflow-hidden">
        <button type="button" aria-label={`${ariaLabel} −`} onClick={() => nudge(-step)}
          className="px-2.5 text-muted hover:text-fg hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
          <Minus className="w-4 h-4" />
        </button>
        <input type="number" inputMode="decimal" value={value} aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(String(clamp(base)))}
          className="w-full min-w-0 text-sm bg-transparent px-1 py-2.5 text-center text-fg tabular-nums focus:outline-none" />
        <button type="button" aria-label={`${ariaLabel} ＋`} onClick={() => nudge(step)}
          className="px-2.5 text-muted hover:text-fg hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
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

// ── Inline set editor: ∓ steppers + last-session line + live 1RM ──
interface SetEditorProps {
  /** Free-text mode (exercise not in the catalog) — shows a name input. */
  customMode: boolean;
  name: string;
  setName: (s: string) => void;
  /** Weight in the user's display unit (kg or lbs), as a string. */
  weight: string;
  setWeight: (s: string) => void;
  reps: string;
  setReps: (s: string) => void;
  sets: string;
  setSets: (s: string) => void;
  logTime: string;
  setLogTime: (s: string) => void;
  /** Coaching cue for the selected exercise ('' hides the tip card). */
  coachAdvice: string;
  /** Last logged session for this exercise (weight in kg), or null. */
  last: { weight: number; reps: number; sets: number; daysAgo: number } | null;
  /** Current PR for this exercise, if any. */
  pr: PersonalRecord | undefined;
  /** Live estimated 1RM (kg) for the current weight×reps; 0 hides the line. */
  orm: number;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * The tap-record set editor, lifted to module scope so it keeps a stable
 * component identity. Defining it inside the page body (as a closure or IIFE)
 * would remount it on every keystroke — the parent re-renders as the steppers
 * change state — and steal input focus. At module level the same editor is
 * reused verbatim under both the program card and the catalog browser, with the
 * caller deciding where it renders (one at a time).
 */
function SetEditor({
  customMode, name, setName, weight, setWeight, reps, setReps, sets, setSets,
  logTime, setLogTime, coachAdvice, last, pr, orm, onSubmit,
}: SetEditorProps) {
  const { t, lang } = useLanguage();
  const { unit } = useWeightUnit();
  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-3 border-t border-line">
      {/* Free-text name (catalog fallback) */}
      {customMode && (
        <div>
          <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.workoutName}</label>
          <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)}
            placeholder="ベンチプレス、スクワットなど"
            className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-3 py-2.5 text-fg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400" />
        </div>
      )}

      {/* Last-session line + PR badge */}
      {name && (last || pr) && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
          {last ? (
            <span className="text-faint">
              {t.lastSessionPrefix}{' '}
              <span className="text-muted font-semibold">
                {last.weight > 0 ? formatWeight(last.weight, unit) : t.bodyweightLabel} × {last.reps}{lang === 'en' ? ' reps' : '回'} × {last.sets}set
              </span>
              <span className="ml-1 text-faint">・{last.daysAgo === 0 ? t.todayShort : lang === 'en' ? `${last.daysAgo}d ago` : `${last.daysAgo}日前`}</span>
            </span>
          ) : (
            <span className="text-indigo-500 dark:text-indigo-400 font-semibold">✨ {t.firstChallengeLabel}</span>
          )}
          {pr && (
            <span className="text-[9px] font-black bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">
              🏆 PR {formatWeight(pr.maxWeight, unit)}
            </span>
          )}
        </div>
      )}

      {/* Coach tip (only when the selected exercise carries one) */}
      {coachAdvice && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-3 border border-green-100 dark:border-green-800 flex gap-2 items-start">
          <ShieldAlert className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed font-medium">{coachAdvice}</p>
        </div>
      )}

      {/* ∓ steppers — prefilled from the last session, still directly editable */}
      <div className="grid grid-cols-3 gap-2">
        <Stepper label={`${t.stepWeight} (${unit})`} ariaLabel={t.stepWeight} value={weight} step={2.5} min={0} onChange={setWeight} />
        <Stepper label={t.stepReps} ariaLabel={t.stepReps} value={reps} step={1} min={1} onChange={setReps} />
        <Stepper label={t.stepSets} ariaLabel={t.stepSets} value={sets} step={1} min={1} onChange={setSets} />
      </div>

      {/* Log time (defaults to now) */}
      <div>
        <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.selectLogTime}</label>
        <input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)}
          className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-3 py-2.5 text-fg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400" />
      </div>

      {/* Live estimated 1RM (Epley) */}
      {orm > 0 && (
        <p className="text-[11px] text-faint text-right" aria-live="polite">
          {lang === 'en' ? 'Est. 1RM' : '推定1RM'}:{' '}
          <span className="font-black text-brand-600 dark:text-brand-400 tabular-nums">{formatWeight(orm, unit)}</span>
        </p>
      )}

      <button type="submit" disabled={!name.trim()}
        className="
          w-full py-3.5 rounded-2xl font-black text-sm text-white
          bg-gradient-to-r from-brand-500 to-brand-600
          shadow-[0_4px_14px_rgba(16,185,129,0.4)]
          hover:from-brand-600 hover:to-brand-700
          hover:scale-[1.01] active:scale-[0.98]
          transition-all duration-200
          disabled:opacity-40 disabled:pointer-events-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
        "
      >
        {t.recordWorkoutBtn}
      </button>
    </form>
  );
}

export default function WorkoutPage() {
  const today = todayLocal();
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
  const [customMode, setCustomMode]      = useState(false);  // 「その他（手入力）」chip active
  const [name, setName]                  = useState('');
  const [musclePart, setMusclePart]      = useState<MusclePart>('chest');
  const [weight, setWeight]              = useState('40');
  const [reps, setReps]                  = useState('10');
  const [sets, setSets]                  = useState('3');
  const [logTime, setLogTime]            = useState(getCurrentTime());
  const [coachAdvice, setCoachAdvice]    = useState(t.defaultCoachTip);
  const [allBadges, setAllBadges]        = useState<Badge[]>([]);

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

  // Active program → today's session driving the program card at the top.
  const [activeProgram,    setActiveProgram]    = useState<TrainingProgram | null>(null);
  const [todaySessionId,   setTodaySessionId]   = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // Which surface owns the open set editor (only one renders at a time).
  const [editorSource, setEditorSource] = useState<'planned' | 'catalog'>('catalog');

  const loadData = useCallback(() => {
    const data = getAppData();
    setWorkouts(data.workoutEntries.filter((w) => w.date === today));
    setFoodEntries(data.foodEntries.filter((f) => f.date === today));
    setAllBadges(getBadges());
    setAllWorkouts(data.workoutEntries);
    setPersonalRecords(data.personalRecords ?? {});
    setActiveProgram(getActiveProgram());
    const profile = getHealthProfile();
    setWorkoutWarnings(getWorkoutWarnings(profile.healthConditions, profile.medications ?? []));
  }, [today]);


   
   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    loadData();
    // Default the program card to today's planned session (once, on mount); the
    // user's later selection is preserved across submits — loadData never resets it.
    const ts = getTodaySession();
    setTodaySessionId(ts?.id ?? null);
    setSelectedSessionId(ts?.id ?? null);
  }, [loadData]);

  useEffect(() => {
    if (!prToast) return;
    const t = setTimeout(() => setPrToast(null), 3000);
    return () => clearTimeout(t);
  }, [prToast]);

  /** Catalog default weight + coach tips keyed by exercise name. Plan exercises
   *  borrow these when a name matches the catalog (else fall back to 0 / notes). */
  const catalogByName = useMemo(() => {
    const m = new Map<string, ExerciseDef>();
    for (const list of Object.values(EXERCISES_BY_PART)) {
      for (const ex of list) m.set(ex.name, ex);
    }
    return m;
  }, []);

  /** Localized muscle-part label, e.g. 'chest' → 胸 / Chest. */
  const partLabel = (mp: MusclePart) =>
    t[`mp${mp.charAt(0).toUpperCase()}${mp.slice(1)}` as 'mpChest'];

  /** Switch muscle part and collapse any open exercise selection. */
  const handleSelectPart = (part: MusclePart) => {
    setSelectedPart(part);
    setCustomMode(false);
    setName('');
    setEditorSource('catalog');
    setCoachAdvice(t.defaultCoachTip);
  };

  /** Pick a catalog exercise: prefill the steppers from its last session. */
  const handleSelectExercise = (ex: ExerciseDef) => {
    const last = getLastSession(ex.name, allWorkouts, today);
    const init = resolveInitialSetValues(ex, last);  // weight in kg
    setCustomMode(false);
    setName(ex.name);
    setMusclePart(selectedPart);
    setEditorSource('catalog');
    // Steppers show the user's display unit; storage stays kg (see toKg).
    setWeight(String(toDisplay(init.weight, unit)));
    setReps(String(init.reps));
    setSets(String(init.sets));
    setCoachAdvice(lang === 'en' && ex.coachTipEn ? ex.coachTipEn : (ex.coachTip ?? ''));
  };

  /**
   * Pick a planned exercise from the program card: prefill the steppers from the
   * plan's target (weight/reps/sets) but let a real logged history override it
   * via progressive overload — same resolver as the catalog path. Names that
   * match the catalog also borrow its coach tip + weight fallback.
   */
  const handleSelectPlanned = (pe: PlannedExercise) => {
    const last = getLastSession(pe.name, allWorkouts, today);
    const catDef = catalogByName.get(pe.name);
    const def = plannedExerciseDefaults(pe, catDef?.defaultWeight);
    const init = resolveInitialSetValues(def, last);  // weight in kg
    setCustomMode(false);
    setName(pe.name);
    setMusclePart(pe.musclePart);
    setSelectedPart(pe.musclePart);   // keep the catalog browse below in sync
    setEditorSource('planned');
    setWeight(String(toDisplay(init.weight, unit)));
    setReps(String(init.reps));
    setSets(String(init.sets));
    const tip = catDef ? (lang === 'en' && catDef.coachTipEn ? catDef.coachTipEn : catDef.coachTip) : undefined;
    setCoachAdvice(tip ?? pe.notes ?? '');
  };

  /** Enter free-text fallback for an exercise not in the catalog. */
  const enterCustomMode = () => {
    setCustomMode(true);
    setName('');
    setMusclePart(selectedPart);
    setEditorSource('catalog');
    setWeight('');
    setReps('10');
    setSets('3');
    setCoachAdvice(t.defaultCoachTip);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const wt = toKg(parseFloat(weight) || 0);
    const isNewPR = await checkAndUpdatePR(name.trim(), wt, today);

    await addWorkoutEntry({
      id: crypto.randomUUID(),
      date: today,
      name: name.trim(),
      category: 'strength',
      musclePart,
      weight: wt,
      reps:   parseInt(reps)  || 0,
      sets:   parseInt(sets)  || 0,
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
        calorieGoal: data.goals.calories, proteinGoal: data.goals.protein,
        fatGoal: data.goals.fat, carbsGoal: data.goals.carbs,
        waterConsumed: data.waterByDate[today] ?? 0, waterGoal: data.goals.water ?? 2000,
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

  const cardCls = 'bg-card rounded-3xl p-4 shadow-card border border-line';

  // ── Program card derivations ──
  /** Session selected in the program card (today's by default, or any other). */
  const currentSession = activeProgram?.sessions.find((s) => s.id === selectedSessionId) ?? null;
  /** Names logged today — the source of truth for the ✓ completion marks. */
  const todaysNames = workouts.map((w) => w.name);
  const progress = getSessionProgress(currentSession?.exercises.map((e) => e.name) ?? [], todaysNames);

  // ── Set-editor derivations (shared by both editor mount points) ──
  const editorLast = name ? getLastSession(name, allWorkouts, today) : null;
  const editorPr = personalRecords[name];
  const editorOrm = epley1RM(toKg(parseFloat(weight) || 0), parseInt(reps) || 0);

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28 lg:pb-8 max-w-md lg:max-w-2xl mx-auto lg:px-6">
      {/* Badge Celebration */}
      {celebrationBadges.length > 0 && (
        <BadgeCelebration badges={celebrationBadges} onClose={() => setCelebrationBadges([])} />
      )}

      {/* PR Toast */}
      {prToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-yellow-400 text-yellow-900 font-black text-sm px-5 py-3 rounded-2xl shadow-lg animate-slide-in-up whitespace-nowrap">
          {prToast}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 via-emerald-600 to-teal-600 text-white px-4 pt-12 pb-8 rounded-b-[2.5rem] shadow-[0_16px_48px_rgba(16,185,129,0.25)]">
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

        {/* 0 ── 今日のセッション（実施中プログラム連動）── */}
        {activeProgram ? (
          <section className={`${cardCls} space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-black text-fg flex items-center gap-1.5">
                <CalendarCheck className="w-5 h-5 text-brand-600 dark:text-brand-400" /> {t.todaySessionTitle}
              </h2>
              <span className="text-[11px] font-bold text-faint truncate max-w-[45%]" title={activeProgram.name}>
                {activeProgram.name}
              </span>
            </div>

            {/* Session selector — defaults to today; any session is selectable */}
            <select
              value={selectedSessionId ?? ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
              aria-label={t.todaySessionTitle}
              className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-3 py-2.5 text-fg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400"
            >
              <option value="">{t.pickSession}</option>
              {activeProgram.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.id === todaySessionId ? `・${t.todayShort}` : ''}
                </option>
              ))}
            </select>

            {currentSession ? (
              <>
                <div className="space-y-1.5">
                  {currentSession.exercises.map((pe) => {
                    const done = progress.doneByName[pe.name];
                    const selected = editorSource === 'planned' && name === pe.name;
                    return (
                      <div key={pe.id}>
                        <button type="button" onClick={() => handleSelectPlanned(pe)}
                          className={`
                            w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left
                            transition-all duration-200 active:scale-[0.99]
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                            ${selected
                              ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-300 dark:border-brand-700'
                              : 'bg-surface-2 border border-transparent hover:border-line-strong'}
                          `}
                        >
                          {done
                            ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                            : <Circle className="w-5 h-5 text-faint shrink-0" />}
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm font-bold truncate ${done ? 'line-through text-faint' : 'text-fg'}`}>
                              {pe.name}
                            </span>
                            <span className="block text-[11px] text-faint truncate">
                              {t.targetLabel}: {partLabel(pe.musclePart)} · {pe.sets}×{pe.repsMin}-{pe.repsMax}
                              {pe.targetWeight ? ` @ ${formatWeight(pe.targetWeight, unit)}` : ''}
                            </span>
                          </span>
                        </button>
                        {selected && (
                          <SetEditor
                            customMode={customMode} name={name} setName={setName}
                            weight={weight} setWeight={setWeight} reps={reps} setReps={setReps}
                            sets={sets} setSets={setSets} logTime={logTime} setLogTime={setLogTime}
                            coachAdvice={coachAdvice} last={editorLast} pr={editorPr} orm={editorOrm}
                            onSubmit={handleSubmit}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress + all-done celebration */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs font-bold text-muted tabular-nums">
                    {progress.doneCount}/{progress.total} {t.doneLabel}
                  </span>
                  {progress.complete && (
                    <span className="text-xs font-black text-green-600 dark:text-green-400">{t.sessionComplete}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-xs text-faint py-4">{t.restDayToday}</p>
            )}
          </section>
        ) : (
          <Link href="/plan" className="block text-center text-xs text-faint hover:text-fg underline py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded">
            {t.noActiveProgramHint}
          </Link>
        )}

        {/* 1 ── 部位 → 種目をタップ → その場で記録するワンフロー ── */}
        <section className={`${cardCls} space-y-3`}>
          <h2 className="font-black text-fg flex items-center gap-1.5">
            <Flame className="w-5 h-5 text-orange-500" /> {t.recommendedByGroup}
          </h2>

          {/* Muscle-part chips (with recovery badge) */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {PARTS.map((p) => {
              const days = getDaysSinceGroup(p.id, allWorkouts);
              const recoveryDot =
                days === null  ? null :
                days === 0     ? <span className="block text-[9px] font-bold leading-none text-red-400/90">{t.todayShort}</span> :
                days === 1     ? <span className="block text-[9px] font-bold leading-none text-amber-400">{lang === 'en' ? '1d ago' : '1日前'}</span> :
                                 <span className="block text-[9px] font-bold leading-none text-emerald-400">{lang === 'en' ? `${days}d ago` : `${days}日前`}</span>;
              return (
                <button key={p.id} type="button" onClick={() => handleSelectPart(p.id)}
                  className={`
                    flex flex-col items-center px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap
                    transition-all duration-200 hover:scale-[1.04] active:scale-95
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                    ${selectedPart === p.id
                      ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                      : 'bg-surface-2 text-muted'}
                  `}
                >
                  {p.label}
                  {recoveryDot}
                </button>
              );
            })}
          </div>

          {/* Exercise chips: history-first, then catalog order; ＋ その他 fallback */}
          <div className="flex flex-wrap gap-1.5">
            {orderByRecency(EXERCISES_BY_PART[selectedPart], allWorkouts).map((ex) => {
              const selected = !customMode && name === ex.name;
              return (
                <button key={ex.name} type="button" onClick={() => handleSelectExercise(ex)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap
                    transition-all duration-200 hover:scale-[1.04] active:scale-95
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                    ${selected
                      ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                      : 'bg-surface-2 text-muted'}
                  `}
                >
                  {ex.name}
                </button>
              );
            })}
            <button type="button" onClick={enterCustomMode}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap
                transition-all duration-200 hover:scale-[1.04] active:scale-95
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                ${customMode
                  ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                  : 'bg-surface-2 text-muted'}
              `}
            >
              <Plus className="w-3.5 h-3.5" /> {t.exerciseOther}
            </button>
          </div>

          {/* Inline set editor — only when the catalog owns the selection */}
          {editorSource === 'catalog' && (customMode || name) && (
            <SetEditor
              customMode={customMode} name={name} setName={setName}
              weight={weight} setWeight={setWeight} reps={reps} setReps={setReps}
              sets={sets} setSets={setSets} logTime={logTime} setLogTime={setLogTime}
              coachAdvice={coachAdvice} last={editorLast} pr={editorPr} orm={editorOrm}
              onSubmit={handleSubmit}
            />
          )}
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

          {isSupabaseConfigured() && !aiAdvice && !aiLoading && (
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
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 border border-emerald-100 dark:border-emerald-800">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">💡 {t.tomorrowAdviceLabel}</p>
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
            <p className="text-center text-xs text-faint py-6">{t.noTimelineEntries}</p>
          ) : (
            <div className="relative border-l-2 border-line ml-3 pl-5 space-y-4 pt-1">
              {timeline.map((entry) => (
                <div key={entry.id} className="relative">
                  <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 shadow-sm ${entry._type === 'food' ? 'bg-orange-400' : 'bg-green-500'}`} />
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
