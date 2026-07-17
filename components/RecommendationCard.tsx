'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Heart, ThumbsUp, ThumbsDown } from 'lucide-react';
import { getAppData, getHealthProfile, getWaterForDate, getStreak, getLatestWeightEntry, getRecommendationFeedback, addRecommendationFeedback, getRealGoals } from '@/lib/data';
import { postJson } from '@/lib/httpClient';
import { buildAffinityModel, rankRecommendation, type AffinityModel } from '@/lib/recommend-preference';
import { explainFood, explainExercise, type ExplanationFactor } from '@/lib/recommend-explain';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Recommendation, FeedbackKind, DailyGoals } from '@/lib/types';
import { CARD_CLASS as CARD } from '@/components/ui/Card';

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


type ItemType = 'food' | 'exercise';

function feedbackKey(itemType: ItemType, name: string): string {
  return `${itemType}:${name}`;
}

/** Snapshot stored feedback as a key→kind map for quick highlight lookup. */
function loadFeedbackMap(): Record<string, FeedbackKind> {
  const map: Record<string, FeedbackKind> = {};
  for (const f of getRecommendationFeedback()) {
    map[feedbackKey(f.itemType, f.itemName)] = f.kind;
  }
  return map;
}

/** Accept / reject / ♡ controls for a single recommended item (Phase B). */
function FeedbackButtons({
  active,
  onReact,
}: {
  active?: FeedbackKind;
  onReact: (kind: FeedbackKind) => void;
}) {
  const base =
    'p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]';
  return (
    <div className="flex items-center gap-1 mt-1.5" role="group" aria-label="この推薦へのフィードバック">
      <button
        type="button"
        onClick={() => onReact('favorite')}
        aria-pressed={active === 'favorite'}
        aria-label="お気に入り"
        className={`${base} ${active === 'favorite' ? 'text-pink-500' : 'text-faint hover:text-pink-400'}`}
      >
        <Heart size={12} className={active === 'favorite' ? 'fill-current' : undefined} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onReact('accept')}
        aria-pressed={active === 'accept'}
        aria-label="役に立った"
        className={`${base} ${active === 'accept' ? 'text-success' : 'text-faint hover:text-success'}`}
      >
        <ThumbsUp size={12} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onReact('reject')}
        aria-pressed={active === 'reject'}
        aria-label="興味なし"
        className={`${base} ${active === 'reject' ? 'text-danger' : 'text-faint hover:text-danger'}`}
      >
        <ThumbsDown size={12} aria-hidden />
      </button>
    </div>
  );
}

/** Horizontal bar chart for XAI explanation factors. */
function XaiBar({ factors }: { factors: ExplanationFactor[] }) {
  if (factors.length === 0) {
    return (
      <p className="text-xs text-faint italic py-1">
        まだ十分なデータがありません。食事・運動を記録するほど精度が上がります。
      </p>
    );
  }
  const maxAbs = Math.max(...factors.map(f => Math.abs(f.weight)), 0.01);
  return (
    <div className="space-y-1 pt-0.5">
      {factors.map(f => (
        <div key={f.label} className="flex items-center gap-1.5">
          <span className="text-xs text-faint w-28 flex-shrink-0 truncate">{f.label}</span>
          <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${f.direction === 'positive' ? 'bg-ai' : 'bg-danger'}`}
              style={{ width: `${(Math.abs(f.weight) / maxAbs) * 100}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-faint w-6 text-right">
            {f.weight > 0 ? '+' : ''}{f.weight.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RecommendationCard() {
  const { t } = useLanguage();
  const [rec,          setRec]          = useState<Recommendation | null>(null);
  const [model,        setModel]        = useState<AffinityModel | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [expanded,     setExpanded]     = useState(false);
  const [openDrawers,  setOpenDrawers]  = useState<Set<string>>(new Set());
  const [feedback,     setFeedback]     = useState<Record<string, FeedbackKind>>({});
  // null = no real goals → never send fabricated defaults to the LLM (P0 #4b).
  const [realGoals,    setRealGoals]    = useState<DailyGoals | null>(null);
  const [goalsLoaded,  setGoalsLoaded]  = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only localStorage read on mount
    setRealGoals(getRealGoals());
    setGoalsLoaded(true);
  }, []);

  const toggleDrawer = (key: string) =>
    setOpenDrawers(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });

  const { isAuthenticated } = useProfile();

  const generate = async () => {
    if (!realGoals) return; // gated in the UI; belt-and-braces against fabricated goals
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
        goals: realGoals,
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

      // Phase B: re-rank the (already safety-filtered) items by learned preference.
      const model = buildAffinityModel({
        foodHistory:    appData.foodEntries.map(e => e.name),
        workoutHistory: appData.workoutEntries.map(e => ({ name: e.name, category: e.category })),
        feedback:       getRecommendationFeedback(),
      });
      setRec(rankRecommendation(data, model));
      setModel(model);
      setOpenDrawers(new Set());
      setFeedback(loadFeedbackMap());
    } catch (err) {
      setError(err instanceof Error ? err.message : '推薦の生成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const react = (
    itemType: ItemType,
    name: string,
    kind: FeedbackKind,
    extra: { macroHighlight?: string; category?: string },
  ): void => {
    addRecommendationFeedback({
      id:        crypto.randomUUID(),
      itemType,
      itemName:  name,
      kind,
      createdAt: new Date().toISOString(),
      ...extra,
    });
    setFeedback(prev => ({ ...prev, [feedbackKey(itemType, name)]: kind }));
  };

  if (!isAuthenticated) {
    return (
      <div className={`${CARD} p-4 mb-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} className="text-ai" />
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
          <Sparkles size={15} className="text-ai" />
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
          {realGoals && (
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
                  : 'bg-ai-soft text-ai hover:opacity-80'}
              `}
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              {loading ? '生成中...' : rec ? '更新' : '生成'}
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="text-xs text-danger bg-danger-soft rounded-2xl px-3 py-2.5 mb-3">
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
      {!rec && !loading && !error && goalsLoaded && (
        realGoals ? (
          <p className="text-xs text-faint text-center py-3">
            「生成」をタップして今日の推薦を取得
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
            <div className="bg-warning-soft border border-warning/30 rounded-2xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={11} className="text-warning flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-black text-warning uppercase tracking-widest">
                  健康注意事項
                </span>
              </div>
              {rec.warnings.map((w, i) => (
                <p key={i} className="text-xs text-warning leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Macro caps applied (deterministic safety clamp) */}
          {rec.macroCapsApplied && rec.macroCapsApplied.length > 0 && (
            <div className="bg-danger-soft border border-danger/30 rounded-2xl px-3 py-2.5">
              <p className="text-xs font-black text-danger uppercase tracking-widest mb-1">
                🛡️ 安全のため目標値を制限
              </p>
              {rec.macroCapsApplied.map((cap, i) => (
                <p key={i} className="text-xs text-danger leading-relaxed">
                  {cap}
                </p>
              ))}
            </div>
          )}

          {/* Foods */}
          <div>
            <p className="text-xs font-black text-faint uppercase tracking-widest mb-2">
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
                      <span className="text-xs font-semibold text-faint flex-shrink-0 tabular-nums">
                        ~{food.calories}kcal
                      </span>
                    </div>
                    <p className="text-xs text-faint leading-relaxed">
                      {food.reason}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className="inline-block text-xs font-bold text-success bg-success-soft px-1.5 py-0.5 rounded-full">
                        {food.macroHighlight}
                      </span>
                      {food.macroFit && (
                        <span className="inline-block text-xs font-bold text-info bg-info-soft px-1.5 py-0.5 rounded-full">
                          🎯 {food.macroFit}
                        </span>
                      )}
                    </div>
                    {food.safetyNotes && food.safetyNotes.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {food.safetyNotes.map((note, j) => (
                          <p key={j} className="text-xs text-warning leading-relaxed flex items-start gap-1">
                            <AlertTriangle size={9} className="text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{note.message}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <FeedbackButtons
                      active={feedback[feedbackKey('food', food.name)]}
                      onReact={(kind) => react('food', food.name, kind, { macroHighlight: food.macroHighlight })}
                    />
                    {/* XAI drawer */}
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => toggleDrawer(`food:${food.name}`)}
                        className="flex items-center gap-1 text-xs text-ai hover:underline transition-colors"
                        aria-expanded={openDrawers.has(`food:${food.name}`)}
                      >
                        {openDrawers.has(`food:${food.name}`) ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                        なぜこれ？
                      </button>
                      {openDrawers.has(`food:${food.name}`) && (
                        <XaiBar factors={model ? explainFood(food.name, food.macroHighlight, model) : []} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exercises */}
          <div>
            <p className="text-xs font-black text-faint uppercase tracking-widest mb-2">
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
                      <span className="text-xs font-semibold text-ai flex-shrink-0">
                        {ex.duration}
                      </span>
                    </div>
                    <p className="text-xs text-faint leading-relaxed">
                      {ex.reason}
                    </p>
                    <FeedbackButtons
                      active={feedback[feedbackKey('exercise', ex.name)]}
                      onReact={(kind) => react('exercise', ex.name, kind, { category: ex.category })}
                    />
                    {/* XAI drawer */}
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => toggleDrawer(`ex:${ex.name}`)}
                        className="flex items-center gap-1 text-xs text-ai hover:underline transition-colors"
                        aria-expanded={openDrawers.has(`ex:${ex.name}`)}
                      >
                        {openDrawers.has(`ex:${ex.name}`) ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                        なぜこれ？
                      </button>
                      {openDrawers.has(`ex:${ex.name}`) && (
                        <XaiBar factors={model ? explainExercise(ex.name, ex.category, model) : []} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Adjusted macros proposal */}
          {rec.adjustedMacros && (
            <div className="bg-info-soft border border-info/20 rounded-2xl px-3 py-2.5">
              <p className="text-xs font-black text-info uppercase tracking-widest mb-2">
                💡 AIが提案する最適化目標値
              </p>
              <div className="grid grid-cols-5 gap-1">
                {(
                  [
                    { label: 'カロリー', value: `${rec.adjustedMacros.calories}`, unit: 'kcal', color: 'text-green-600 dark:text-green-400' },
                    { label: 'タンパク', value: `${rec.adjustedMacros.protein}`,  unit: 'g',    color: 'text-brand-600 dark:text-brand-400' },
                    { label: '脂質',     value: `${rec.adjustedMacros.fat}`,      unit: 'g',    color: 'text-amber-600 dark:text-amber-400' },
                    { label: '炭水化',   value: `${rec.adjustedMacros.carbs}`,    unit: 'g',    color: 'text-blue-600 dark:text-blue-400' },
                    { label: '水分',     value: `${rec.adjustedMacros.water}`,    unit: 'ml',   color: 'text-sky-600 dark:text-sky-400' },
                  ] as const
                ).map(({ label, value, unit, color }) => (
                  <div key={label} className="text-center">
                    <div className={`text-xs font-black tabular-nums ${color}`}>{value}</div>
                    <div className="text-xs text-faint">{unit}</div>
                    <div className="text-xs text-faint">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-faint leading-relaxed">
            ※ 本推薦は情報提供であり、医療上の判断は主治医・薬剤師にご相談ください。
          </p>
          <p className="text-xs text-faint text-right">
            生成: {new Date(rec.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
