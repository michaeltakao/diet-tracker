'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, RefreshCw, Trophy, TrendingDown, TrendingUp } from 'lucide-react';
import { getAppData, getStreak, getWeightEntries, getHealthProfile, getRealGoals } from '@/lib/data';
import { postJson, HttpError } from '@/lib/httpClient';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DailyGoals } from '@/lib/types';
import { CARD_CLASS as CARD } from '@/components/ui/Card';

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
  if (s >= 80) return { grade: 'A', color: 'text-success', bg: 'bg-success-soft' };
  if (s >= 60) return { grade: 'B', color: 'text-info', bg: 'bg-info-soft' };
  if (s >= 40) return { grade: 'C', color: 'text-warning', bg: 'bg-warning-soft' };
  return             { grade: 'D', color: 'text-danger', bg: 'bg-danger-soft' };
}


export default function WeeklyReportCard() {
  const { isAuthenticated } = useProfile();
  const { t } = useLanguage();
  const [report,  setReport]  = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  // null = no real goals → goal-relative report generation is gated (P0 #4b).
  const [goals,       setGoals]       = useState<DailyGoals | null>(null);
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only localStorage read on mount
    setGoals(getRealGoals());
    setGoalsLoaded(true);
  }, []);

  const generate = async () => {
    if (!goals) return; // gated in the UI; never report against fabricated goals
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

      const report = await postJson<WeeklyReport>('/api/weekly-report', {
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
        healthConditions: getHealthProfile().healthConditions,
        medications: getHealthProfile().medications ?? [],
      });
      setReport(report);
    } catch (err) {
      if (err instanceof HttpError && err.status === 422) {
        setError('週次レポートには最低2日分のデータが必要です');
        return;
      }
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
          <h2 className="font-black text-fg">週次レポート</h2>
        </div>
        <div className="flex items-center gap-2">
          {report && sl && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${sl.bg} ${sl.color}`}>
              {sl.grade} {report.weekScore}点
            </span>
          )}
          {goals && (
            <button
              onClick={generate}
              disabled={loading}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                transition-all duration-200 hover:scale-[1.03] active:scale-95
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                ${loading
                  ? 'bg-surface-2 text-faint cursor-not-allowed'
                  : 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-200'}
              `}
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              {loading ? '生成中...' : report ? '更新' : '生成'}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-faint mb-4 pl-8">過去7日間のAI分析レポート（1時間に3回まで）</p>

      {error && (
        <div className="text-xs text-warning bg-warning-soft rounded-2xl px-3 py-2.5 mb-3">
          ⚠️ {error}
        </div>
      )}

      {loading && !report && (
        <div className="flex items-center justify-center py-6 gap-2 text-xs text-faint">
          <RefreshCw size={13} className="animate-spin" />
          7日間のデータを分析中...
        </div>
      )}

      {!report && !loading && !error && goalsLoaded && (
        goals ? (
          <p className="text-xs text-faint text-center py-3">
            「生成」をタップして今週の振り返りレポートを取得
          </p>
        ) : (
          /* No real goals → set-goals CTA instead of the generate flow (P0 #4b) */
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
        )
      )}

      {report && (
        <div className="space-y-3 animate-slide-in-up">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '平均カロリー', value: `${report.avgCalories}`, unit: 'kcal', color: 'text-green-600 dark:text-green-400' },
              { label: 'タンパク平均', value: `${report.avgProtein}`,  unit: 'g',    color: 'text-brand-600 dark:text-brand-400' },
              { label: 'カロリー達成', value: `${report.calorieCompliance}`, unit: '%', color: 'text-blue-600 dark:text-blue-400' },
              { label: 'トレーニング', value: `${report.workoutDays}`, unit: '日',   color: 'text-purple-600 dark:text-purple-400' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="bg-surface-2 rounded-2xl p-2.5 text-center">
                <p className={`text-sm font-black tabular-nums ${color}`}>{value}</p>
                <p className="text-[9px] text-faint">{unit}</p>
                <p className="text-[9px] text-faint leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Weight change */}
          {report.weightChange !== null && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-2xl">
              {report.weightChange < 0
                ? <TrendingDown size={14} className="text-success flex-shrink-0" />
                : report.weightChange > 0
                ? <TrendingUp   size={14} className="text-danger flex-shrink-0" />
                : null}
              <span className="text-xs font-semibold text-muted">
                今週の体重変化：
                <span className={`font-black ml-1 ${
                  report.weightChange < 0 ? 'text-success'
                  : report.weightChange > 0 ? 'text-danger'
                  : 'text-muted'}`}>
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
            <div className="bg-success-soft rounded-2xl p-3 border border-success/20">
              <div className="flex items-center gap-1 mb-1.5">
                <Trophy size={10} className="text-success" />
                <p className="text-[10px] font-black text-success uppercase tracking-wide">今週の成果</p>
              </div>
              <p className="text-xs text-muted leading-relaxed">{report.highlight}</p>
            </div>
            <div className="bg-warning-soft rounded-2xl p-3 border border-warning/20">
              <p className="text-[10px] font-black text-warning uppercase tracking-wide mb-1.5">改善ポイント</p>
              <p className="text-xs text-muted leading-relaxed">{report.improvement}</p>
            </div>
          </div>

          {/* Next week goal */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-2xl p-3 border border-teal-100 dark:border-teal-800">
            <p className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">来週の目標</p>
            <p className="text-xs font-semibold text-muted leading-relaxed">{report.nextWeekGoal}</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[9px] text-faint">
              生成: {new Date(report.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              onClick={() => { setReport(null); setError(null); }}
              className="text-[10px] text-faint hover:text-fg underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
