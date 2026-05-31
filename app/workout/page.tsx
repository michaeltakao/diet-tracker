'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getAppData, addWorkoutEntry, removeWorkoutEntry,
  checkAndUpdatePR, addBadge, checkAndAwardBadges, getStreak, getBadges,
  getHealthProfile,
} from '@/lib/data';
import { WorkoutEntry, MusclePart, CoachMenu, FoodEntry, Badge, PersonalRecord } from '@/lib/types';
import {
  Dumbbell, Clock, Flame, ShieldAlert, CheckCircle,
  Trash2, ChevronRight, Sparkles,
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

const RECOMMENDED_MENUS: CoachMenu[] = [
  { id: 'c1', name: 'ベンチプレス',            musclePart: 'chest',     defaultWeight: 40, defaultReps: 10, defaultSets: 3,
    coachTip: '大胸筋をしっかりストレッチさせる意識で、バーを胸まで下ろしましょう！',
    coachTipEn: 'Focus on stretching your chest as you lower the bar — bring it all the way to your chest!' },
  { id: 'c2', name: 'ダンベルフライ',          musclePart: 'chest',     defaultWeight: 10, defaultReps: 12, defaultSets: 3,
    coachTip: 'トップポジションで顎を引くと、大胸筋上部まで強く収縮します！',
    coachTipEn: 'Tuck your chin at the top to engage the upper chest for a stronger contraction.' },
  { id: 'b1', name: 'ラットプルダウン',        musclePart: 'back',      defaultWeight: 35, defaultReps: 10, defaultSets: 3,
    coachTip: '胸を張り、バーを鎖骨に向かって引くことで背中に強烈に効きます。',
    coachTipEn: 'Puff your chest out and pull the bar toward your collarbone for maximum back engagement.' },
  { id: 'b2', name: 'デッドリフト',            musclePart: 'back',      defaultWeight: 60, defaultReps: 8,  defaultSets: 3,
    coachTip: '背中を絶対に丸めないように！お腹に力を入れて体幹を固定しましょう。',
    coachTipEn: 'Never round your back! Brace your core hard to keep your spine neutral throughout.' },
  { id: 'l1', name: 'バーベルスクワット',      musclePart: 'legs',      defaultWeight: 50, defaultReps: 8,  defaultSets: 3,
    coachTip: 'お尻を後ろに引くように。膝が内側に入らないよう注意してください！',
    coachTipEn: 'Push your hips back and keep your knees tracking over your toes — never let them cave in.' },
  { id: 'l2', name: 'レッグプレス',            musclePart: 'legs',      defaultWeight: 80, defaultReps: 12, defaultSets: 3,
    coachTip: '膝が90度になる位置まで深く下ろすと大腿四頭筋にしっかり効きます。',
    coachTipEn: 'Lower the platform until your knees reach 90° for full quad activation.' },
  { id: 's1', name: 'ショルダープレス',        musclePart: 'shoulders', defaultWeight: 10, defaultReps: 12, defaultSets: 3,
    coachTip: '肩がすくまないように、耳から肩を離した状態で真上に押し上げます。',
    coachTipEn: 'Keep your shoulders down — press straight up with ears away from shoulders.' },
  { id: 's2', name: 'サイドレイズ',            musclePart: 'shoulders', defaultWeight: 5,  defaultReps: 15, defaultSets: 3,
    coachTip: '小指側を少し高くして、三角筋中部を意識して真横に上げましょう。',
    coachTipEn: 'Lead with your pinky slightly higher to isolate the lateral deltoid.' },
  { id: 'a1', name: 'アームカール',            musclePart: 'arms',      defaultWeight: 8,  defaultReps: 12, defaultSets: 3,
    coachTip: '肘の位置をしっかりと固定し、反動を使わずに二頭筋の力だけで持ち上げて！',
    coachTipEn: 'Lock your elbows in place and curl using only your biceps — no swinging!' },
  { id: 'a2', name: 'トライセプスプレスダウン', musclePart: 'arms',     defaultWeight: 15, defaultReps: 12, defaultSets: 3,
    coachTip: '肘を体の横に固定したまま、前腕だけを動かして三頭筋を収縮させましょう。',
    coachTipEn: 'Keep elbows pinned to your sides and move only your forearms to fully squeeze the triceps.' },
  { id: 'ab1', name: 'クランチ',               musclePart: 'abs',      defaultWeight: 0,  defaultReps: 15, defaultSets: 3,
    coachTip: 'おへそを覗き込むようにして、お腹を上から潰していく感覚が大切です。',
    coachTipEn: 'Curl up as if trying to see your navel — imagine crushing your abs from the top down.' },
  { id: 'ab2', name: 'プランク',               musclePart: 'abs',      defaultWeight: 0,  defaultReps: 30, defaultSets: 3,
    coachTip: '腰が落ちないよう体を一直線に保ちながら、お腹に力を入れ続けましょう。',
    coachTipEn: 'Keep your body in a straight line — don\'t let your hips drop, and squeeze your core continuously.' },
];

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

  const loadData = useCallback(() => {
    const data = getAppData();
    setWorkouts(data.workoutEntries.filter((w) => w.date === today));
    setFoodEntries(data.foodEntries.filter((f) => f.date === today));
    setAllBadges(getBadges());
    setAllWorkouts(data.workoutEntries);
    setPersonalRecords(data.personalRecords ?? {});
    const profile = getHealthProfile();
    setWorkoutWarnings(getWorkoutWarnings(profile.healthConditions, profile.medications ?? []));
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!prToast) return;
    const t = setTimeout(() => setPrToast(null), 3000);
    return () => clearTimeout(t);
  }, [prToast]);

  const handleSelectMenu = (menu: CoachMenu) => {
    const last      = getLastSession(menu.name, allWorkouts, today);
    const suggested = suggestWeight(last, menu.defaultWeight);
    setName(menu.name);
    setMusclePart(menu.musclePart);
    // Form weight is shown in the user's display unit; storage stays kg.
    setWeight(String(toDisplay(suggested, unit)));
    setReps(String(menu.defaultReps));
    setSets(String(menu.defaultSets));
    setCoachAdvice(lang === 'en' && menu.coachTipEn ? menu.coachTipEn : menu.coachTip);
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
                                 <span className="block text-[9px] font-bold leading-none text-emerald-400">{lang === 'en' ? `${days}d ago` : `${days}日前`}</span>;
              return (
                <button key={p.id} type="button" onClick={() => setSelectedPart(p.id)}
                  className={`
                    flex flex-col items-center px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap
                    transition-all duration-200 hover:scale-[1.04] active:scale-95
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
        </section>

        {/* 2 ── 入力フォーム ──────────────── */}
        <section className={`${cardCls} space-y-4`}>
          {/* Coach tip */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-3 border border-green-100 dark:border-green-800 flex gap-2 items-start">
            <ShieldAlert className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed font-medium">{coachAdvice}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.workoutName}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ベンチプレス、スクワットなど"
                className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-3 py-2.5 text-fg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400" />
            </div>

            {/* Log time */}
            <div>
              <label className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.selectLogTime}</label>
              <input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)}
                className="w-full text-sm bg-surface-2 border border-line-strong rounded-xl px-3 py-2.5 text-fg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400" />
            </div>

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

            {/* Live estimated 1RM (Epley) */}
            {(() => {
              const orm = epley1RM(toKg(parseFloat(weight) || 0), parseInt(reps) || 0);
              if (orm <= 0) return null;
              return (
                <p className="text-[11px] text-faint text-right" aria-live="polite">
                  {lang === 'en' ? 'Est. 1RM' : '推定1RM'}:{' '}
                  <span className="font-black text-brand-600 dark:text-brand-400 tabular-nums">{formatWeight(orm, unit)}</span>
                </p>
              );
            })()}

            <button type="submit"
              className="
                w-full py-3.5 rounded-2xl font-black text-sm text-white
                bg-gradient-to-r from-brand-500 to-brand-600
                shadow-[0_4px_14px_rgba(16,185,129,0.4)]
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
