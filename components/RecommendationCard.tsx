'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { getAppData, getHealthProfile, getWaterForDate, getStreak, getLatestWeightEntry } from '@/lib/data';
import { postJson } from '@/lib/httpClient';
import { useProfile } from '@/contexts/ProfileContext';
import type { Recommendation } from '@/lib/types';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

const MACRO_ICONS: Array<[string, string]> = [
  ['高タンパク', '💪'],
  ['タンパク',   '💪'],
  ['低脂質',     '🥗'],
  ['低糖質',     '🥦'],
  ['低塩',       '🧂'],
  ['食物繊維',   '🌾'],
  ['ビタミン',   '🥕'],
  ['カルシウム', '🥛'],
  ['鉄分',       '🥩'],
  ['オメガ',     '🐟'],
];

function getFoodIcon(macroHighlight: string): string {
  for (const [key, icon] of MACRO_ICONS) {
    if (macroHighlight.includes(key)) return icon;
  }
  return '🍽️';
}

const CATEGORY_ICONS: Record<string, string> = {
  strength:    '🏋️',
  cardio:      '🏃',
  flexibility: '🧘',
  other:       '⚡',
};

const CARD = 'bg-card rounded-3xl shadow-card border border-line';

export default function RecommendationCard() {
  const [rec,      setRec]      = useState<Recommendation | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const { isAuthenticated } = useProfile();

  const generate = async () => {
    setLoading(true);
    setError(null);
    setExpanded(true);

    try {
      const today   = getTodayDate();
      const appData = getAppData();
      const profile = getHealthProfile();
      const water   = getWaterForDate(today);
      const streak  = getStreak();

      const todayFood     = appData.foodEntries.filter(e => e.date === today);
      const todayCalories = todayFood.reduce((s, e) => s + e.calories, 0);
      const todayProtein  = todayFood.reduce((s, e) => s + e.protein,  0);
      const todayFat      = todayFood.reduce((s, e) => s + e.fat,      0);
      const todayCarbs    = todayFood.reduce((s, e) => s + e.carbs,    0);

      const recentFoodLog = [...appData.foodEntries]
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        .slice(0, 10)
        .map(e => ({ date: e.date, name: e.name, calories: e.calories, mealType: e.mealType }));

      const recentWorkoutLog = [...appData.workoutEntries]
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
        .slice(0, 7)
        .map(e => ({ date: e.date, name: e.name, category: e.category }));

      const data = await postJson<Recommendation>('/api/recommend', {
        profile,
        goals: appData.goals,
        today,
        todayCalories,
        todayProtein,
        todayFat,
        todayCarbs,
        waterConsumed:    water,
        recentFoodLog,
        recentWorkoutLog,
        streak,
        weightKg:         getLatestWeightEntry()?.weight ?? null,
      });
      setRec(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '推薦の生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={`${CARD} p-4 mb-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} className="text-violet-400" />
          <span className="text-xs font-black text-faint uppercase tracking-widest">
            パーソナライズ推薦
          </span>
        </div>
        <p className="text-xs text-faint text-center py-2 leading-relaxed">
          ログインして個人に最適化された<br />食事・運動推薦を取得できます
        </p>
      </div>
    );
  }

  return (
    <div className={`${CARD} p-4 mb-3`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-violet-500" />
          <span className="text-xs font-black text-faint uppercase tracking-widest">
            今日のパーソナライズ推薦
          </span>
        </div>
        <div className="flex items-center gap-2">
          {rec && (
            <button
              onClick={() => setExpanded(p => !p)}
              aria-expanded={expanded}
              className="text-faint hover:text-muted transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={expanded ? '折りたたむ' : '展開する'}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl
              text-xs font-bold transition-all duration-200
              hover:scale-[1.03] active:scale-95
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              ${loading
                ? 'bg-surface-2 text-faint cursor-not-allowed'
                : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50'}
            `}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            {loading ? '生成中...' : rec ? '更新' : '生成'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-2xl px-3 py-2.5 mb-3">
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !rec && (
        <div className="flex items-center justify-center py-6 gap-2 text-xs text-faint">
          <RefreshCw size={13} className="animate-spin" />
          AIがあなたのデータを分析中...
        </div>
      )}

      {/* ── Empty state ── */}
      {!rec && !loading && !error && (
        <p className="text-xs text-faint text-center py-3">
          「生成」をタップして今日の推薦を取得
        </p>
      )}

      {/* ── Collapsed summary ── */}
      {rec && !expanded && (
        <div className="flex items-center gap-3 text-xs text-faint">
          <span>🍽️ {rec.foods.length}件の食事推薦</span>
          <span>💪 {rec.exercises.length}件の運動推薦</span>
          {rec.warnings.length > 0 && (
            <span className="text-warning">⚠️ {rec.warnings.length}件の注意</span>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {rec && expanded && (
        <div className="space-y-4 animate-slide-in-up">

          {/* Warnings */}
          {rec.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={11} className="text-warning flex-shrink-0" aria-hidden="true" />
                <span className="text-[10px] font-black text-warning uppercase tracking-widest">
                  健康注意事項
                </span>
              </div>
              {rec.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Macro caps applied (deterministic safety clamp) */}
          {rec.macroCapsApplied && rec.macroCapsApplied.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-3 py-2.5">
              <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">
                🛡️ 安全のため目標値を制限
              </p>
              {rec.macroCapsApplied.map((cap, i) => (
                <p key={i} className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  {cap}
                </p>
              ))}
            </div>
          )}

          {/* Foods */}
          <div>
            <p className="text-[10px] font-black text-faint uppercase tracking-widest mb-2">
              🍽️ おすすめの食事
            </p>
            <div className="space-y-2">
              {rec.foods.map((food, i) => (
                <div
                  key={i}
                  className="bg-surface-2 rounded-2xl px-3 py-2.5 flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0 mt-0.5" aria-hidden>
                    {getFoodIcon(food.macroHighlight)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold text-fg truncate">
                        {food.name}
                      </span>
                      <span className="text-[10px] font-semibold text-faint flex-shrink-0 tabular-nums">
                        ~{food.calories}kcal
                      </span>
                    </div>
                    <p className="text-[10px] text-faint leading-relaxed">
                      {food.reason}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className="inline-block text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                        {food.macroHighlight}
                      </span>
                      {food.macroFit && (
                        <span className="inline-block text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                          🎯 {food.macroFit}
                        </span>
                      )}
                    </div>
                    {food.safetyNotes && food.safetyNotes.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {food.safetyNotes.map((note, j) => (
                          <p key={j} className="text-[9px] text-amber-700 dark:text-amber-300 leading-relaxed flex items-start gap-1">
                            <AlertTriangle size={9} className="text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{note.message}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exercises */}
          <div>
            <p className="text-[10px] font-black text-faint uppercase tracking-widest mb-2">
              💪 おすすめの運動
            </p>
            <div className="space-y-2">
              {rec.exercises.map((ex, i) => (
                <div
                  key={i}
                  className="bg-surface-2 rounded-2xl px-3 py-2.5 flex items-start gap-2.5"
                >
                  <span className="text-base flex-shrink-0 mt-0.5" aria-hidden>
                    {CATEGORY_ICONS[ex.category] ?? '⚡'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-bold text-fg truncate">
                        {ex.name}
                      </span>
                      <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0">
                        {ex.duration}
                      </span>
                    </div>
                    <p className="text-[10px] text-faint leading-relaxed">
                      {ex.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Adjusted macros proposal */}
          {rec.adjustedMacros && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl px-3 py-2.5">
              <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">
                💡 AIが提案する最適化目標値
              </p>
              <div className="grid grid-cols-5 gap-1">
                {(
                  [
                    { label: 'カロリー', value: `${rec.adjustedMacros.calories}`, unit: 'kcal', color: 'text-green-600 dark:text-green-400' },
                    { label: 'タンパク', value: `${rec.adjustedMacros.protein}`,  unit: 'g',    color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: '脂質',     value: `${rec.adjustedMacros.fat}`,      unit: 'g',    color: 'text-amber-600 dark:text-amber-400' },
                    { label: '炭水化',   value: `${rec.adjustedMacros.carbs}`,    unit: 'g',    color: 'text-blue-600 dark:text-blue-400' },
                    { label: '水分',     value: `${rec.adjustedMacros.water}`,    unit: 'ml',   color: 'text-sky-600 dark:text-sky-400' },
                  ] as const
                ).map(({ label, value, unit, color }) => (
                  <div key={label} className="text-center">
                    <div className={`text-[10px] font-black tabular-nums ${color}`}>{value}</div>
                    <div className="text-[8px] text-faint">{unit}</div>
                    <div className="text-[8px] text-faint">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] text-faint leading-relaxed">
            ※ 本推薦は情報提供であり、医療上の判断は主治医・薬剤師にご相談ください。
          </p>
          <p className="text-[9px] text-faint text-right">
            生成: {new Date(rec.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
