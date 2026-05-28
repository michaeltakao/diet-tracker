'use client';

import { useState } from 'react';
import { CalendarDays, RefreshCw, Trophy, TrendingDown, TrendingUp } from 'lucide-react';
import { getAppData, getStreak, getWeightEntries } from '@/lib/data';
import { useProfile } from '@/contexts/ProfileContext';

interface WeeklyReport {
  weekScore:         number;
  avgCalories:       number;
  avgProtein:        number;
  calorieCompliance: number;
  workoutDays:       number;
  weightChange:      number | null;
  summary:           string;
  highlight:         string;
  improvement:       string;
  nextWeekGoal:      string;
  generatedAt:       string;
}

function get7Days(): { startDate: string; endDate: string; dates: string[] } {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return { startDate: dates[0], endDate: dates[6], dates };
}

function scoreLabel(s: number): { grade: string; color: string; bg: string } {
  if (s >= 80) return { grade: 'A', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' };
  if (s >= 60) return { grade: 'B', color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-100 dark:bg-blue-900/30' };
  if (s >= 40) return { grade: 'C', color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-100 dark:bg-amber-900/30' };
  return             { grade: 'D', color: 'text-red-500 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/30' };
}

const CARD = 'bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700';

export default function WeeklyReportCard() {
  const { isAuthenticated, goals } = useProfile();
  const [report,  setReport]  = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate, dates } = get7Days();
      const appData   = getAppData();
      const streak    = getStreak();
      const waterGoal = goals.water ?? 2000;

      const dailyNutrition = dates.map(date => {
        const entries = appData.foodEntries.filter(e => e.date === date);
        return {
          date,
          calories:  entries.reduce((s, e) => s + e.calories, 0),
          protein:   entries.reduce((s, e) => s + e.protein,  0),
          fat:       entries.reduce((s, e) => s + e.fat,      0),
          carbs:     entries.reduce((s, e) => s + e.carbs,    0),
          water:     appData.waterByDate[date] ?? 0,
          mealCount: entries.length,
        };
      });

      const weekWorkouts = appData.workoutEntries.filter(w => w.date >= startDate && w.date <= endDate);
      const workoutDays  = new Set(weekWorkouts.map(w => w.date)).size;

      const allWeights  = getWeightEntries(30);
      const weekWeights = allWeights.filter(w => w.date >= startDate && w.date <= endDate);
      const weightStart = weekWeights.at(0)?.weight ?? null;
      const weightEnd   = weekWeights.at(-1)?.weight ?? null;

      const res = await fetch('/api/weekly-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          startDate, endDate,
          calorieGoal: goals.calories,
          proteinGoal: goals.protein,
          fatGoal:     goals.fat,
          carbsGoal:   goals.carbs,
          waterGoal,
          dailyNutrition,
          workoutDays,
          totalWorkouts: weekWorkouts.length,
          weightStart,
          weightEnd,
          streak,
        }),
      });

      if (res.status === 422) { setError('週次レポートには最低2日分のデータが必要です'); return; }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setReport(await res.json() as WeeklyReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'レポートの生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  const sl = report ? scoreLabel(report.weekScore) : null;

  return (
    <section className={`${CARD} p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl">
            <CalendarDays className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-black text-gray-800 dark:text-gray-200">週次レポート</h2>
        </div>
        <div className="flex items-center gap-2">
          {report && sl && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${sl.bg} ${sl.color}`}>
              {sl.grade} {report.weekScore}点
            </span>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
              transition-all duration-200 hover:scale-[1.03] active:scale-95
              ${loading
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-200'}
            `}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            {loading ? '生成中...' : report ? '更新' : '生成'}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 pl-8">過去7日間のAI分析レポート（1時間に3回まで）</p>

      {error && (
        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-2xl px-3 py-2.5 mb-3">
          ⚠️ {error}
        </div>
      )}

      {loading && !report && (
        <div className="flex items-center justify-center py-6 gap-2 text-xs text-gray-400 dark:text-gray-500">
          <RefreshCw size={13} className="animate-spin" />
          7日間のデータを分析中...
        </div>
      )}

      {!report && !loading && !error && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
          「生成」をタップして今週の振り返りレポートを取得
        </p>
      )}

      {report && (
        <div className="space-y-3 animate-slide-in-up">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '平均カロリー', value: `${report.avgCalories}`, unit: 'kcal', color: 'text-green-600 dark:text-green-400' },
              { label: 'タンパク平均', value: `${report.avgProtein}`,  unit: 'g',    color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'カロリー達成', value: `${report.calorieCompliance}`, unit: '%', color: 'text-blue-600 dark:text-blue-400' },
              { label: 'トレーニング', value: `${report.workoutDays}`, unit: '日',   color: 'text-purple-600 dark:text-purple-400' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-2.5 text-center">
                <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500">{unit}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Weight change */}
          {report.weightChange !== null && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
              {report.weightChange < 0
                ? <TrendingDown size={14} className="text-emerald-500 flex-shrink-0" />
                : report.weightChange > 0
                ? <TrendingUp   size={14} className="text-red-400 flex-shrink-0" />
                : null}
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                今週の体重変化：
                <span className={`font-black ml-1 ${
                  report.weightChange < 0 ? 'text-emerald-600 dark:text-emerald-400'
                  : report.weightChange > 0 ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-600'}`}>
                  {report.weightChange > 0 ? '+' : ''}{report.weightChange} kg
                </span>
              </span>
            </div>
          )}

          {/* AI Summary */}
          <div className="bg-teal-50 dark:bg-teal-900/20 rounded-2xl p-3 border border-teal-100 dark:border-teal-800">
            <p className="text-xs text-teal-700 dark:text-teal-300 leading-relaxed">{report.summary}</p>
          </div>

          {/* Highlight + Improvement */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 border border-emerald-100 dark:border-emerald-800">
              <div className="flex items-center gap-1 mb-1.5">
                <Trophy size={10} className="text-emerald-500" />
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">今週の成果</p>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{report.highlight}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 border border-amber-100 dark:border-amber-800">
              <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">改善ポイント</p>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{report.improvement}</p>
            </div>
          </div>

          {/* Next week goal */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-2xl p-3 border border-teal-100 dark:border-teal-800">
            <p className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">来週の目標</p>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 leading-relaxed">{report.nextWeekGoal}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[9px] text-gray-300 dark:text-gray-600">
              生成: {new Date(report.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              onClick={() => { setReport(null); setError(null); }}
              className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 underline"
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
