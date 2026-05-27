'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getAppData, addWorkoutEntry, removeWorkoutEntry,
  checkAndUpdatePR, addBadge, checkAndAwardBadges, getStreak,
} from '@/lib/storage';
import { WorkoutEntry, MusclePart, CoachMenu, FoodEntry, Badge } from '@/lib/types';
import {
  Dumbbell, Clock, Flame, ShieldAlert, CheckCircle,
  Trash2, ChevronRight, Sparkles, Trophy,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import BadgeCelebration from '@/components/BadgeCelebration';

const RECOMMENDED_MENUS: CoachMenu[] = [
  { id: 'c1', name: 'ベンチプレス', musclePart: 'chest', defaultWeight: 40, defaultReps: 10, defaultSets: 3, coachTip: '大胸筋をしっかりストレッチさせる意識で、バーを胸まで下ろしましょう！' },
  { id: 'c2', name: 'ダンベルフライ', musclePart: 'chest', defaultWeight: 10, defaultReps: 12, defaultSets: 3, coachTip: 'トップポジションで顎を引くと、大胸筋上部まで強く収縮します！' },
  { id: 'b1', name: 'ラットプルダウン', musclePart: 'back', defaultWeight: 35, defaultReps: 10, defaultSets: 3, coachTip: '胸を張り、バーを鎖骨に向かって引くことで背中に強烈に効きます。' },
  { id: 'b2', name: 'デッドリフト', musclePart: 'back', defaultWeight: 60, defaultReps: 8, defaultSets: 3, coachTip: '背中を絶対に丸めないように！お腹に力を入れて体幹を固定しましょう。' },
  { id: 'l1', name: 'バーベルスクワット', musclePart: 'legs', defaultWeight: 50, defaultReps: 8, defaultSets: 3, coachTip: 'お尻を後ろに引くように。膝が内側に入らないよう注意してください！' },
  { id: 'l2', name: 'レッグプレス', musclePart: 'legs', defaultWeight: 80, defaultReps: 12, defaultSets: 3, coachTip: '膝が90度になる位置まで深く下ろすと大腿四頭筋にしっかり効きます。' },
  { id: 's1', name: 'ショルダープレス', musclePart: 'shoulders', defaultWeight: 10, defaultReps: 12, defaultSets: 3, coachTip: '肩がすくまないように、耳から肩を離した状態で真上に押し上げます。' },
  { id: 's2', name: 'サイドレイズ', musclePart: 'shoulders', defaultWeight: 5, defaultReps: 15, defaultSets: 3, coachTip: '小指側を少し高くして、三角筋中部を意識して真横に上げましょう。' },
  { id: 'a1', name: 'アームカール', musclePart: 'arms', defaultWeight: 8, defaultReps: 12, defaultSets: 3, coachTip: '肘の位置をしっかりと固定し、反動を使わずに二頭筋の力だけで持ち上げて！' },
  { id: 'a2', name: 'トライセプスプレスダウン', musclePart: 'arms', defaultWeight: 15, defaultReps: 12, defaultSets: 3, coachTip: '肘を体の横に固定したまま、前腕だけを動かして三頭筋を収縮させましょう。' },
  { id: 'ab1', name: 'クランチ', musclePart: 'abs', defaultWeight: 0, defaultReps: 15, defaultSets: 3, coachTip: 'おへそを覗き込むようにして、お腹を上から潰していく感覚が大切です。' },
  { id: 'ab2', name: 'プランク', musclePart: 'abs', defaultWeight: 0, defaultReps: 30, defaultSets: 3, coachTip: '腰が落ちないよう体を一直線に保ちながら、お腹に力を入れ続けましょう。' },
];

const PARTS = [
  { id: 'chest' as MusclePart, label: '胸' },
  { id: 'back' as MusclePart, label: '背中' },
  { id: 'legs' as MusclePart, label: '脚' },
  { id: 'shoulders' as MusclePart, label: '肩' },
  { id: 'arms' as MusclePart, label: '腕' },
  { id: 'abs' as MusclePart, label: '腹筋' },
];

interface CoachAdvice {
  todayAdvice: string;
  habitInsight: string;
  tomorrowTip: string;
  motivationMessage: string;
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } catch { return '--:--'; }
}

export default function WorkoutPage() {
  const today = getTodayDate();
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [selectedPart, setSelectedPart] = useState<MusclePart>('chest');
  const [name, setName] = useState('');
  const [musclePart, setMusclePart] = useState<MusclePart>('chest');
  const [weight, setWeight] = useState('40');
  const [reps, setReps] = useState('10');
  const [sets, setSets] = useState('3');
  const [coachAdvice, setCoachAdvice] = useState('メニューを選択すると、ここにパーソナルアドバイスが表示されます。');

  // AI coach
  const [aiAdvice, setAiAdvice] = useState<CoachAdvice | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // PR & Badge celebration
  const [celebrationBadges, setCelebrationBadges] = useState<Badge[]>([]);
  const [prToast, setPrToast] = useState<string | null>(null);

  const loadData = useCallback(() => {
    const data = getAppData();
    setWorkouts(data.workoutEntries.filter((w) => w.date === today));
    setFoodEntries(data.foodEntries.filter((f) => f.date === today));
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Dismiss PR toast after 3s
  useEffect(() => {
    if (!prToast) return;
    const t = setTimeout(() => setPrToast(null), 3000);
    return () => clearTimeout(t);
  }, [prToast]);

  const handleSelectMenu = (menu: CoachMenu) => {
    setName(menu.name);
    setMusclePart(menu.musclePart);
    setWeight(String(menu.defaultWeight));
    setReps(String(menu.defaultReps));
    setSets(String(menu.defaultSets));
    setCoachAdvice(menu.coachTip);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const wt = parseFloat(weight) || 0;
    const isNewPR = checkAndUpdatePR(name.trim(), wt, today);

    addWorkoutEntry({
      id: crypto.randomUUID(),
      date: today,
      name: name.trim(),
      category: 'strength',
      musclePart,
      weight: wt,
      reps: parseInt(reps) || 0,
      sets: parseInt(sets) || 0,
      addedAt: new Date().toISOString(),
    });

    // PR badge & toast
    if (isNewPR && wt > 0) {
      const prBadge: Badge = {
        id: crypto.randomUUID(),
        type: 'pr_achieved',
        name: `💪 ${name.trim()} PR達成！`,
        description: `${name.trim()} で ${wt}kg の自己ベストを更新しました！`,
        icon: '💪',
        earnedAt: new Date().toISOString(),
      };
      addBadge(prBadge);
      setPrToast(`🏆 PR更新！${name.trim()} ${wt}kg`);
      setCelebrationBadges([prBadge]);
    }

    // Check other badges
    const newBadges = checkAndAwardBadges(today);
    if (newBadges.length > 0 && !isNewPR) {
      setCelebrationBadges(newBadges);
    }

    loadData();
    setName('');
  };

  const handleDelete = (id: string) => {
    removeWorkoutEntry(id);
    loadData();
  };

  const handleGetAIAdvice = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const data = getAppData();
      const todayFood = data.foodEntries.filter((e) => e.date === today);
      const totals = todayFood.reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          protein: acc.protein + e.protein,
          fat: acc.fat + e.fat,
          carbs: acc.carbs + e.carbs,
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      // Recent food log (last 14 entries)
      const recentFoodLog = [...data.foodEntries]
        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
        .slice(0, 14)
        .map((f) => ({
          date: f.date,
          time: formatTime(f.addedAt),
          name: f.name,
          calories: f.calories,
          mealType: f.mealType,
        }));

      // Recent workout log (last 10)
      const recentWorkoutLog = [...data.workoutEntries]
        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
        .slice(0, 10)
        .map((w) => ({ date: w.date, name: w.name, weight: w.weight ?? 0 }));

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          today,
          todayCalories: totals.calories,
          todayProtein: totals.protein,
          todayFat: totals.fat,
          todayCarbs: totals.carbs,
          calorieGoal: data.goals.calories,
          proteinGoal: data.goals.protein,
          fatGoal: data.goals.fat,
          carbsGoal: data.goals.carbs,
          waterConsumed: data.waterByDate[today] ?? 0,
          waterGoal: data.goals.water ?? 2000,
          todayWorkouts: workouts.map((w) => ({
            name: w.name,
            weight: w.weight ?? 0,
            reps: w.reps ?? 0,
            sets: w.sets ?? 0,
          })),
          recentFoodLog,
          recentWorkoutLog,
          streak: getStreak(),
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }

      const advice = await res.json() as CoachAdvice;
      setAiAdvice(advice);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setAiLoading(false);
    }
  };

  const timeline = [
    ...foodEntries.map((f) => ({ ...f, _type: 'food' as const })),
    ...workouts.map((w) => ({ ...w, _type: 'workout' as const })),
  ].sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());

  return (
    <main className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Badge Celebration Overlay */}
      {celebrationBadges.length > 0 && (
        <BadgeCelebration
          badges={celebrationBadges}
          onClose={() => setCelebrationBadges([])}
        />
      )}

      {/* PR Toast */}
      {prToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 bg-yellow-400 text-yellow-900 font-bold text-sm px-5 py-3 rounded-2xl shadow-lg animate-slide-in-up whitespace-nowrap">
          {prToast}
        </div>
      )}

      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Dumbbell className="w-6 h-6" /> AIパーソナルコーチ
        </h1>
        <p className="text-green-100 text-sm mt-1">部位別メニュー提案＋習慣タイムライン</p>
      </div>

      <div className="p-4 space-y-5">
        {/* 1. 部位別メニュー */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-1.5">
            <Flame className="w-5 h-5 text-orange-500" /> 部位別おすすめメニュー
          </h2>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {PARTS.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelectedPart(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedPart === p.id ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{p.label}</button>
            ))}
          </div>
          <div className="space-y-2">
            {RECOMMENDED_MENUS.filter((m) => m.musclePart === selectedPart).map((menu) => (
              <button key={menu.id} type="button" onClick={() => handleSelectMenu(menu)}
                className="w-full text-left bg-gray-50 hover:bg-green-50 border border-gray-100 rounded-xl p-3 flex items-center justify-between transition-all group">
                <div>
                  <p className="text-sm font-bold text-gray-800 group-hover:text-green-600">{menu.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    推奨: <b className="text-gray-700">{menu.defaultWeight}kg</b> × <b className="text-gray-700">{menu.defaultReps}回</b> × <b className="text-gray-700">{menu.defaultSets}set</b>
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </section>

        {/* 2. 入力フォーム */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div className="bg-green-50 rounded-xl p-3 border border-green-100 flex gap-2 items-start">
            <ShieldAlert className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-xs text-green-800 leading-relaxed font-medium">{coachAdvice}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">種目名</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ベンチプレス、スクワットなど"
                className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-400" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['重量(kg)', weight, setWeight], ['回数', reps, setReps], ['セット', sets, setSets]] as const).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
                  <input type="number" value={val} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-2 py-2.5 text-center focus:outline-none focus:border-green-500" />
                </div>
              ))}
            </div>
            <button type="submit"
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-sm py-3 rounded-xl transition-colors">
              今日のトレーニングに記録する
            </button>
          </form>
        </section>

        {/* 3. AI パーソナルコーチ */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-1.5">
            <Sparkles className="w-5 h-5 text-purple-500" /> AIパーソナルコーチ
          </h2>
          <p className="text-xs text-gray-400">今日の食事・トレーニングを分析してアドバイスを生成します</p>

          {!aiAdvice && !aiLoading && (
            <button
              onClick={handleGetAIAdvice}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              AIアドバイスを取得する
            </button>
          )}

          {aiLoading && (
            <div className="flex items-center justify-center gap-3 py-6 text-purple-500">
              <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-500 rounded-full animate-spin" />
              <span className="text-sm font-medium">Geminiが分析中...</span>
            </div>
          )}

          {aiError && (
            <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">
              ⚠️ {aiError}
              <button onClick={handleGetAIAdvice} className="ml-2 underline">再試行</button>
            </div>
          )}

          {aiAdvice && (
            <div className="space-y-3">
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                <p className="text-xs font-bold text-purple-600 mb-1.5">📊 今日の総評</p>
                <p className="text-sm text-gray-700 leading-relaxed">{aiAdvice.todayAdvice}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-xs font-bold text-blue-600 mb-1.5">🕐 習慣インサイト</p>
                <p className="text-sm text-gray-700 leading-relaxed">{aiAdvice.habitInsight}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                <p className="text-xs font-bold text-green-600 mb-1.5">💡 明日のアドバイス</p>
                <p className="text-sm text-gray-700 leading-relaxed">{aiAdvice.tomorrowTip}</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100 text-center">
                <p className="text-sm font-bold text-yellow-700">{aiAdvice.motivationMessage}</p>
              </div>
              <button
                onClick={() => { setAiAdvice(null); setAiError(''); }}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 underline"
              >
                再取得する
              </button>
            </div>
          )}
        </section>

        {/* 4. 習慣タイムライン */}
        <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold text-gray-800 flex items-center gap-1.5">
            <Clock className="w-5 h-5 text-blue-500" /> 今日の行動タイムライン
          </h2>
          <p className="text-xs text-gray-400">食事と筋トレを時間軸で確認して生活習慣を改善しましょう</p>
          {timeline.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-6">今日の記録はまだありません</p>
          ) : (
            <div className="relative border-l-2 border-gray-100 ml-3 pl-5 space-y-4 pt-1">
              {timeline.map((entry) => (
                <div key={entry.id} className="relative">
                  <div className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                    entry._type === 'food' ? 'bg-orange-400' : 'bg-green-500'
                  }`} />
                  <span className="text-xs font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded mr-1">
                    {formatTime(entry.addedAt)}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">
                    {entry._type === 'food' ? `🥗 ${(entry as FoodEntry).name}` : `🏋️ ${entry.name}`}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 pl-14">
                    {entry._type === 'food'
                      ? `${(entry as FoodEntry).calories}kcal · P${(entry as FoodEntry).protein}g · F${(entry as FoodEntry).fat}g · C${(entry as FoodEntry).carbs}g`
                      : `${(entry as WorkoutEntry).weight}kg × ${(entry as WorkoutEntry).reps}回 × ${(entry as WorkoutEntry).sets}set`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. 実施済み */}
        {workouts.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">実施済み</h3>
            {workouts.map((w) => (
              <div key={w.id} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{w.name}</p>
                    <p className="text-xs text-gray-500">{w.weight}kg × {w.reps}回 × {w.sets}set</p>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(w.id)}
                  className="p-2 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </section>
        )}

        {/* 6. My Badges (quick view) */}
        <BadgesQuickView />
      </div>
      <BottomNav />
    </main>
  );
}

function BadgesQuickView() {
  const badges = getAppData().badges ?? [];
  if (badges.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <h2 className="font-bold text-gray-800 flex items-center gap-1.5">
        <Trophy className="w-5 h-5 text-yellow-500" /> 獲得バッジ
      </h2>
      <div className="flex flex-wrap gap-2">
        {[...badges]
          .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
          .slice(0, 12)
          .map((b) => (
            <div
              key={b.id}
              title={b.description}
              className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-100 rounded-full px-3 py-1.5"
            >
              <span className="text-base">{b.icon}</span>
              <span className="text-xs font-semibold text-yellow-800">{b.name.replace(/^[^\s]+\s/, '')}</span>
            </div>
          ))}
      </div>
    </section>
  );
}
