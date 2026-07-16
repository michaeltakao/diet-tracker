'use client';

import { useEffect, useState } from 'react';
import { Activity, Info } from 'lucide-react';
import { getAppData, getHealthProfile } from '@/lib/data';
import { postJson } from '@/lib/httpClient';
import { tdeeConfidenceLabel, MIN_DATA_POINTS } from '@/lib/tdee';
import { useLanguage } from '@/contexts/LanguageContext';
import { isMinor } from '@/lib/nutrition-standards';
import { useProfile } from '@/contexts/ProfileContext';
import { CARD_CLASS as CARD } from '@/components/ui/Card';


interface TdeeEstimate {
  tdeeKcal:   number | null;
  rSquared:   number | null;
  dataPoints: number;
  isFallback: boolean;
  date:       string;
}

interface GoalDeficit {
  label:    string;
  kcal:     number;
}

const GOAL_DEFICITS: GoalDeficit[] = [
  { label: '減量 (−500)', kcal: -500 },
  { label: '緩やか減量 (−300)', kcal: -300 },
  { label: '維持',  kcal: 0 },
  { label: '増量 (+300)', kcal: 300 },
];

export default function TdeeCard() {
  const { isAuthenticated } = useProfile();
  const { t } = useLanguage();
  const [estimate, setEstimate] = useState<TdeeEstimate | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [minor,    setMinor]    = useState(false);

  const fetchEstimate = async () => {
    setLoading(true);
    try {
      const appData = getAppData();

      // Aggregate calorie totals per day from food log
      const calByDate = new Map<string, number>();
      for (const e of appData.foodEntries) {
        calByDate.set(e.date, (calByDate.get(e.date) ?? 0) + e.calories);
      }

      const weightLogs = appData.weightEntries.map(e => ({
        date:     e.date,
        weightKg: e.weight,
      }));

      const calorieLogs = [...calByDate.entries()].map(([date, totalKcal]) => ({
        date,
        totalKcal,
      }));

      const result = await postJson<TdeeEstimate>('/api/tdee/estimate', {
        weightLogs,
        calorieLogs,
      });
      setEstimate(result);
    } catch {
      // Silent fail — TDEE is non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage read on mount
    setMinor(isMinor(getHealthProfile().age));
    void fetchEstimate();
  }, [isAuthenticated]);

  if (!isAuthenticated || loading) return null;
  if (!estimate) return null;

  // Insufficient data → honest progress toward the first estimate instead of
  // silently vanishing (#5): 「あと n 日分の記録で代謝が見えます（いま k/7日）」.
  if (estimate.tdeeKcal == null) {
    const k = Math.min(estimate.dataPoints, MIN_DATA_POINTS);
    const remaining = MIN_DATA_POINTS - k;
    if (remaining <= 0) return null; // enough days but no estimate (e.g. degenerate fit)
    return (
      <div className={`${CARD} p-4 mb-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-emerald-500" />
          <span className="text-[10px] font-black text-faint uppercase tracking-widest">
            {t.tdeeHeading}
          </span>
        </div>
        <p className="text-xs text-muted">
          {t.tdeeProgress
            .replace('{n}', String(remaining))
            .replace('{k}', String(k))
            .replace('{total}', String(MIN_DATA_POINTS))}
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(k / MIN_DATA_POINTS) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  const confidence = tdeeConfidenceLabel(estimate.rSquared);
  const tdee       = Math.round(estimate.tdeeKcal);

  return (
    <div className={`${CARD} p-4 mb-3`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-emerald-500" />
          <span className="text-[10px] font-black text-faint uppercase tracking-widest">
            {t.tdeeHeading} ({t.tdeeDataDays.replace('{n}', String(estimate.dataPoints))})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo(p => !p)}
          className="text-faint hover:text-muted transition-colors"
          aria-label="TDEE説明"
        >
          <Info size={13} />
        </button>
      </div>

      {showInfo && (
        <p className="text-[9px] text-faint leading-relaxed mb-3 bg-surface-2 rounded-2xl px-3 py-2">
          体重変化と摂取カロリーの14日間ローリング回帰から推定した消費エネルギー量（TDEE）です。
          データが多いほど精度が上がります。目安としてお使いください。
          {estimate.isFallback && ' ※データ不足のため静的推定式を使用。'}
        </p>
      )}

      <div className="flex items-end gap-3 mb-3">
        <div>
          <span className="text-3xl font-black text-fg tabular-nums">{tdee.toLocaleString()}</span>
          <span className="text-xs text-faint ml-1">kcal/日</span>
        </div>
        <div className="mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            confidence === '高'
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30'
              : confidence === '中'
              ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30'
              : 'text-faint bg-surface-2'
          }`}>
            確信度: {confidence}
          </span>
        </div>
      </div>

      {/* Suggested goal targets — deficit presets are hidden for growth-phase (12–17) users */}
      <div>
        <p className="text-[9px] text-faint uppercase tracking-widest font-black mb-2">目標カロリー候補</p>
        {minor && (
          <p className="text-[9px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-xl px-3 py-1.5 mb-2">
            成長期のため減量向けの目標は表示していません。維持カロリーを目安にしてください。
          </p>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {GOAL_DEFICITS.filter(({ kcal }) => !minor || kcal >= 0).map(({ label, kcal }) => {
            const target = tdee + kcal;
            return (
              <div
                key={label}
                className="bg-surface-2 rounded-2xl px-3 py-2 flex items-center justify-between"
              >
                <span className="text-[9px] text-faint">{label}</span>
                <span className="text-[10px] font-black text-fg tabular-nums">
                  {target.toLocaleString()} kcal
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
